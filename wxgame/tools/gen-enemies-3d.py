#!/usr/bin/env python3
"""星环防线 · 怪物 3D 模型生成器（Blender headless）

用法:
  blender -b -P tools/gen-enemies-3d.py -- [--out assets/enemies] [--frames 16] [--size 192]

产出（每种怪物）:
  <out>/<type>/frame_00..NN.png   朝向 360° 旋转精灵帧（frame_00 朝屏幕右方 +X，顺时针递进）
  <out>/<type>/hero.png           透视特写
  <out>/models/<type>.blend       源模型

美术风格对齐 src/game/config.ts 的 ENEMIES 配色：虫群系生物（发光眼睛/核心 +
金属几丁质外壳），俯视 55° 正交相机与炮塔精灵一致。
"""
import bpy
import math
import os
import sys
import argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='assets/enemies')
ap.add_argument('--frames', type=int, default=16)
ap.add_argument('--size', type=int, default=192)
ap.add_argument('--only', default=None, help='只渲染指定怪物（如 splitter）')
args = ap.parse_args(argv)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_DIR = os.path.normpath(os.path.join(ROOT, args.out)) if not os.path.isabs(args.out) else args.out
MODEL_DIR = os.path.join(OUT_DIR, 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

def hex_rgba(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)

# 与 src/game/config.ts ENEMIES 一致
ENEMIES = {
    'crawler':  {'color': '#7A4FD0', 'glow': '#B89CFF'},
    'speeder':  {'color': '#4FD0C8', 'glow': '#9DFFF2'},
    'tanker':   {'color': '#5B3FA8', 'glow': '#8B5CF6'},
    'splitter': {'color': '#9D6FE8', 'glow': '#D8CCFF'},
    'lurker':   {'color': '#B8FF3D', 'glow': '#E4FFA8'},
    'miniboss': {'color': '#FFC94D', 'glow': '#FFE9B0'},
    'boss':     {'color': '#FF3D81', 'glow': '#FF8FB8'},
}
# 体型缩放（对齐游戏内相对大小；boss 明显更大）
SCALE = {'crawler': 1.0, 'speeder': 0.85, 'tanker': 1.15, 'splitter': 1.0, 'lurker': 0.9, 'miniboss': 1.35, 'boss': 1.55}

# ---------------- 材质/建模助手 ----------------
def mat_shell(name, color, metallic=0.35, roughness=0.45):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return m

def mat_glow(name, color, strength=5.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = color
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m

def point_at(ob, direction):
    """把物体的 +Z 轴对准 direction（锥/柱的轴向定位）"""
    ob.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()

def add_sphere(name, loc, scale, mat, parent=None, ico=False):
    if ico:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=loc)
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=32, ring_count=16, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob

def add_cone(name, loc, r1, r2, depth, mat, parent=None, direction=None):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=r1, radius2=r2, depth=depth, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    if direction is not None:
        point_at(ob, direction)
    if parent:
        ob.parent = parent
    return ob

def add_leg(name, hip, out_dir, length, r, mat, parent):
    """节肢腿：从 hip 沿 out_dir 斜向下伸出，细端朝地面。
    腿挂在 hip 空物体上，行走动画通过旋转 hip 实现（绕外侧横轴前后摆动）"""
    d = Vector(out_dir).normalized()
    mid = Vector(hip) + d * (length / 2)
    hip_ob = bpy.data.objects.new(f'{name}_hip', None)
    bpy.context.collection.objects.link(hip_ob)
    hip_ob.location = hip
    hip_ob.parent = parent
    ob = add_cone(name, mid, r, 0.012, length, mat)
    ob.parent = hip_ob
    ob.matrix_parent_inverse = hip_ob.matrix_world.inverted()
    return hip_ob

# 当前怪物的行走部件：[(hip_empty, phase_offset)]，逐怪物重置
WALK_PARTS = []
# 分裂体专用：[(lobe_root, side)] 与裂核，用于分裂动画
SPLIT_LOBES = []
SPLIT_CORE = None

def parent_keep(ob, parent):
    """挂到 parent 下且保持世界变换不变，之后移动 parent 可整体带动"""
    ob.parent = parent
    ob.matrix_parent_inverse = parent.matrix_world.inverted()

def legs_pair(prefix, xs, half_w, z, mat, parent, length=0.62, r=0.05):
    """两侧对称布腿：xs 为各腿的前后位置；三角步态相位交错登记"""
    for si, sy in enumerate((-1, 1)):
        for i, x in enumerate(xs):
            hip = add_leg(f'{prefix}{sy}{i}', (x, sy * half_w, z),
                          (0.15 * (i - (len(xs) - 1) / 2), sy * 0.85, -1.0), length, r, mat, parent)
            # 三角步态：L1 R2 L3 同相，R1 L2 R3 反相
            WALK_PARTS.append((hip, 0.0 if (i % 2 == 0) == (sy > 0) else math.pi))

def add_box(name, scale, loc, mat, parent=None, rot_z=0.0, rot_y=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    ob.rotation_euler = (0, rot_y, rot_z)
    bpy.ops.object.transform_apply(scale=True)
    if mat:
        ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob

def aim_at(ob, tx=0.0, ty=0.0, tz=0.3):
    direction = Vector((tx, ty, tz)) - ob.location
    ob.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# ---------------- 六种怪物造型（朝 +X 为头） ----------------
def build_crawler(yaw, shell, glow, dark):
    add_sphere('Body', (0, 0, 0.42), (0.62, 0.44, 0.34), shell, yaw)
    add_sphere('Head', (0.55, 0, 0.40), (0.30, 0.30, 0.24), shell, yaw, ico=True)
    for sy in (-1, 1):
        add_sphere(f'Eye{sy}', (0.80, sy * 0.16, 0.47), (0.06, 0.06, 0.06), glow, yaw)
        add_cone(f'Fang{sy}', (0.88, sy * 0.12, 0.30), 0.05, 0.008, 0.28, dark, yaw,
                 direction=(0.8, -sy * 0.25, -0.5))
    legs_pair('Leg', [0.32, 0.02, -0.28], 0.36, 0.38, dark, yaw)
    # 背脊发光点
    for i in range(3):
        add_sphere(f'Dot{i}', (0.15 - i * 0.22, 0, 0.76 - i * 0.02), (0.05, 0.05, 0.03), glow, yaw)

def build_speeder(yaw, shell, glow, dark):
    # 流线型：细长身体 + 后掠扁翼
    add_sphere('Body', (0, 0, 0.38), (0.78, 0.30, 0.26), shell, yaw)
    add_sphere('Head', (0.62, 0, 0.36), (0.26, 0.20, 0.18), shell, yaw, ico=True)
    for sy in (-1, 1):
        add_sphere(f'Eye{sy}', (0.83, sy * 0.11, 0.42), (0.05, 0.05, 0.05), glow, yaw)
        # 后掠扁翼（薄片向后外侧展开）
        add_box(f'Wing{sy}', (0.30, 0.16, 0.025), (-0.12, sy * 0.34, 0.46), dark, yaw,
                rot_z=math.radians(-28 * sy), rot_y=math.radians(-8))
        # 侧线发光条
        add_sphere(f'Stripe{sy}', (0.05, sy * 0.28, 0.40), (0.42, 0.035, 0.05), glow, yaw)
    add_cone('Tail', (-0.80, 0, 0.48), 0.09, 0.006, 0.45, dark, yaw, direction=(-0.9, 0, 0.45))

def build_tanker(yaw, shell, glow, dark):
    # 重甲：三段叠壳 + 粗短腿
    add_sphere('Core', (0, 0, 0.42), (0.60, 0.52, 0.34), dark, yaw)
    for i, (ox, s) in enumerate([(0.28, 0.50), (0.0, 0.58), (-0.30, 0.48)]):
        add_sphere(f'Plate{i}', (ox, 0, 0.50 + 0.04 * (1 - abs(i - 1))), (s, 0.56 - 0.04 * abs(i - 1), 0.30), shell, yaw, ico=True)
    add_sphere('Head', (0.62, 0, 0.38), (0.24, 0.26, 0.20), dark, yaw, ico=True)
    for sy in (-1, 1):
        add_sphere(f'Eye{sy}', (0.82, sy * 0.14, 0.44), (0.05, 0.05, 0.05), glow, yaw)
    legs_pair('Leg', [0.2, -0.25], 0.48, 0.36, shell, yaw, length=0.5, r=0.075)
    # 壳缝发光（露出壳面）
    for ox in (0.14, -0.15):
        add_sphere(f'Seam{ox}', (ox, 0, 0.79), (0.025, 0.44, 0.025), glow, yaw)

def build_splitter(yaw, shell, glow, dark):
    # 双瓣体：左右两瓣（瓣根节点承载瓣体/眼睛/该侧腿，分裂动画整体位移）+ 中央发光裂核
    global SPLIT_CORE
    for sy in (-1, 1):
        root = bpy.data.objects.new(f'LobeRoot{sy}', None)
        bpy.context.collection.objects.link(root)
        root.parent = yaw
        SPLIT_LOBES.append((root, sy))
        parent_keep(add_sphere(f'Lobe{sy}', (0, sy * 0.20, 0.42), (0.55, 0.30, 0.34), shell, ico=True), root)
        parent_keep(add_sphere(f'Eye{sy}', (0.50, sy * 0.30, 0.50), (0.05, 0.05, 0.05), glow), root)
        for i, x in enumerate([0.15, -0.2]):
            hip = add_leg(f'Leg{sy}{i}', (x, sy * 0.42, 0.36),
                          (0.15 * (i - 0.5), sy * 0.85, -1.0), 0.62, 0.05, dark, root)
            WALK_PARTS.append((hip, 0.0 if (i % 2 == 0) == (sy > 0) else math.pi))
    SPLIT_CORE = add_sphere('Core', (0.1, 0, 0.48), (0.32, 0.16, 0.24), glow, yaw)

def build_lurker(yaw, shell, glow, dark):
    # 隐匿者：窄细身体 + 棘刺
    add_sphere('Body', (0, 0, 0.40), (0.62, 0.24, 0.22), shell, yaw)
    add_sphere('Head', (0.55, 0, 0.42), (0.22, 0.16, 0.16), shell, yaw, ico=True)
    for sy in (-1, 1):
        add_sphere(f'Eye{sy}', (0.73, sy * 0.10, 0.48), (0.045, 0.045, 0.045), glow, yaw)
    # 背棘（向上向后）
    for i in range(4):
        x = 0.25 - i * 0.2
        add_cone(f'Spike{i}', (x - 0.08, 0, 0.68), 0.05, 0.004, 0.36, dark, yaw,
                 direction=(-0.45 - i * 0.08, 0, 1.0))
    legs_pair('Leg', [0.28, 0.0, -0.28], 0.20, 0.36, dark, yaw, length=0.55, r=0.04)
    add_cone('TailSting', (-0.72, 0, 0.55), 0.05, 0.004, 0.4, glow, yaw, direction=(-0.85, 0, 0.55))

def build_boss(yaw, shell, glow, dark):
    # 湮灭巨兽：巨型甲壳 + 上翘双角 + 品红核心
    add_sphere('Core', (0, 0, 0.62), (0.85, 0.72, 0.48), dark, yaw)
    for i, (ox, s) in enumerate([(0.35, 0.62), (0.0, 0.72), (-0.38, 0.60)]):
        add_sphere(f'Plate{i}', (ox, 0, 0.72), (s, 0.68, 0.36), shell, yaw, ico=True)
    add_sphere('Head', (0.8, 0, 0.58), (0.34, 0.36, 0.28), dark, yaw, ico=True)
    for sy in (-1, 1):
        add_sphere(f'Eye{sy}', (1.04, sy * 0.20, 0.64), (0.08, 0.08, 0.08), glow, yaw)
        # 弯角：根部前上、尖段上翘
        add_cone(f'HornA{sy}', (0.98, sy * 0.24, 0.95), 0.09, 0.035, 0.5, shell, yaw,
                 direction=(0.45, sy * 0.18, 1.0))
        add_cone(f'HornB{sy}', (1.12, sy * 0.30, 1.28), 0.045, 0.004, 0.38, shell, yaw,
                 direction=(0.15, sy * 0.12, 1.0))
    legs_pair('Leg', [0.42, 0.0, -0.42], 0.62, 0.45, shell, yaw, length=0.68, r=0.085)
    # 胸口发光核心
    add_sphere('ChestCore', (0.95, 0, 0.42), (0.14, 0.14, 0.12), glow, yaw)
    # 背部发光棘
    for i in range(3):
        x = 0.1 - i * 0.3
        add_cone(f'GlowSpike{i}', (x - 0.05, 0, 1.06 - i * 0.02), 0.055, 0.004, 0.32, glow, yaw,
                 direction=(-0.35, 0, 1.0))

def build_miniboss(yaw, shell, glow, dark):
    # 掠晶兽：晶刺簇生的精英掠食者 —— 棱角晶体甲壳 + 背部晶刺簇 + 三只感知眼（金色生物光）
    add_sphere('Core', (0, 0, 0.52), (0.68, 0.56, 0.36), dark, yaw)
    # 晶体甲壳：三块棱角叠板
    for i, (ox, s) in enumerate([(0.30, 0.54), (-0.02, 0.62), (-0.34, 0.50)]):
        add_sphere(f'Plate{i}', (ox, 0, 0.62 + 0.03 * (1 - abs(i - 1))), (s, 0.60 - 0.05 * abs(i - 1), 0.30), shell, yaw, ico=True)
    add_sphere('Head', (0.70, 0, 0.50), (0.28, 0.30, 0.22), dark, yaw, ico=True)
    # 三只感知眼：两侧 + 额心一只（更大）
    for sy in (-1, 1):
        add_sphere(f'Eye{sy}', (0.92, sy * 0.17, 0.56), (0.065, 0.065, 0.065), glow, yaw)
    add_sphere('EyeC', (0.86, 0, 0.72), (0.08, 0.08, 0.06), glow, yaw)
    # 背部晶刺簇（金色晶体，向上向后散射）
    for i in range(5):
        x = 0.28 - i * 0.19
        sy = (i % 2) * 2 - 1
        add_cone(f'Crystal{i}', (x - 0.06, sy * 0.10, 0.92 - i * 0.01), 0.075, 0.004, 0.5, shell, yaw,
                 direction=(-0.4 - i * 0.06, sy * 0.18, 1.0))
    legs_pair('Leg', [0.34, -0.02, -0.36], 0.52, 0.42, dark, yaw, length=0.6, r=0.07)
    # 尾部晶刃
    add_cone('TailBlade', (-0.82, 0, 0.60), 0.07, 0.004, 0.5, glow, yaw, direction=(-0.9, 0, 0.4))
    # 胸口能量晶核
    add_sphere('ChestCore', (0.66, 0, 0.36), (0.10, 0.10, 0.09), glow, yaw)

BUILDERS = {
    'crawler': build_crawler, 'speeder': build_speeder, 'tanker': build_tanker,
    'splitter': build_splitter, 'lurker': build_lurker, 'miniboss': build_miniboss, 'boss': build_boss,
}

# ---------------- 灯光/相机/合成（与炮塔一致，保证画风统一） ----------------
def setup_scene(ortho_scale):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = args.size
    scene.render.resolution_y = args.size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.look = 'AgX - Medium High Contrast'

    def add_light(name, loc, energy, color, size=1.0):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = energy
        data.color = color
        data.shape = 'DISK'
        data.size = size
        ob = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(ob)
        ob.location = loc
        aim_at(ob)
        return ob

    add_light('Key', (-3.5, -2.5, 6.0), 450, (1.0, 0.95, 0.88), size=4.0)
    add_light('Fill', (4.0, 1.5, 3.0), 260, (0.45, 0.62, 1.0), size=3.0)
    add_light('Rim', (1.0, 4.5, 4.5), 420, (0.35, 0.85, 1.0), size=2.5)

    world = bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.03, 0.07, 1.0)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35

    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    glare = nt.nodes.new('CompositorNodeGlare')
    glare.glare_type = 'FOG_GLOW'
    glare.quality = 'HIGH'
    glare.threshold = 1.6
    glare.size = 6
    comp = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], glare.inputs['Image'])
    nt.links.new(glare.outputs['Image'], comp.inputs['Image'])

    cam_data = bpy.data.cameras.new('CamOrtho')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new('CamOrtho', cam_data)
    bpy.context.collection.objects.link(cam)
    elev = math.radians(55)
    cam.location = (0, -8.0 * math.cos(elev), 8.0 * math.sin(elev))
    aim_at(cam, 0, 0, 0.35)
    scene.camera = cam
    return scene

# ---------------- 逐怪物构建 + 渲染 ----------------
for etype, cfg in ENEMIES.items():
    if args.only and etype != args.only:
        continue
    s = SCALE[etype]
    scene = setup_scene(ortho_scale=2.6 * s)
    yaw = bpy.data.objects.new('Yaw', None)
    bpy.context.collection.objects.link(yaw)
    # 不缩放 yaw：行走动画的腿部摆动枢轴在模型空间定位，缩放会导致枢轴错位；
    # 体型差异由正交相机 ortho_scale=2.6*s 与游戏内绘制尺寸共同体现

    shell = mat_shell('Shell', hex_rgba(cfg['color']))
    glow = mat_glow('Glow', hex_rgba(cfg['glow']), strength=5.0)
    dark = mat_shell('Dark', hex_rgba('#1A1330'), metallic=0.4, roughness=0.5)
    WALK_PARTS.clear()
    SPLIT_LOBES.clear()
    SPLIT_CORE = None
    BUILDERS[etype](yaw, shell, glow, dark)

    out_dir = os.path.join(OUT_DIR, etype)
    walk_dir = os.path.join(out_dir, 'walk')
    os.makedirs(walk_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(MODEL_DIR, f'{etype}.blend'))

    # f<dir>_<phase>：dir 自屏幕右方(+X)顺时针；phase 为 4 帧步态循环（三角步态摆腿 + 身体浮沉）
    for i in range(args.frames):
        yaw.rotation_euler.z = math.radians(-(360.0 / args.frames) * i)
        for p in range(4):
            ph = (p / 4) * math.pi * 2
            for hip, off in WALK_PARTS:
                hip.rotation_euler.y = 0.42 * math.sin(ph + off)
            yaw.location.z = 0.035 * math.sin(2 * ph)
            scene.render.filepath = os.path.join(walk_dir, f'f{i:02d}_{p}.png')
            bpy.ops.render.render(write_still=True)
        yaw.location.z = 0.0
    print(f'[gen-enemies-3d] {etype}: {args.frames}x4 frames')

    # 分裂体追加：死亡分裂动画（两瓣外翻分离 + 裂核收缩），6 相位 × 全朝向
    if etype == 'splitter':
        split_dir = os.path.join(out_dir, 'split')
        os.makedirs(split_dir, exist_ok=True)
        for hip, off in WALK_PARTS:
            hip.rotation_euler.y = 0.42 * math.sin(off)  # 定格自然站姿
        for i in range(args.frames):
            yaw.rotation_euler.z = math.radians(-(360.0 / args.frames) * i)
            for p in range(6):
                t = p / 5
                sep = 0.85 * (1 - (1 - t) ** 2)
                for root, sy in SPLIT_LOBES:
                    root.location.y = sy * sep
                    root.rotation_euler.x = sy * 0.6 * t
                    sc = 1 - 0.2 * t
                    root.scale = (sc, sc, sc)
                cs = max(0.01, 1 - 1.15 * t)
                SPLIT_CORE.scale = (cs, cs, cs)
                SPLIT_CORE.location.z = 0.48 - 0.1 * t
                scene.render.filepath = os.path.join(split_dir, f's{i:02d}_{p}.png')
                bpy.ops.render.render(write_still=True)
        # 复位供特写使用
        for root, sy in SPLIT_LOBES:
            root.location = (0, 0, 0)
            root.rotation_euler = (0, 0, 0)
            root.scale = (1, 1, 1)
        SPLIT_CORE.scale = (1, 1, 1)
        SPLIT_CORE.location.z = 0.48
        print(f'[gen-enemies-3d] splitter: {args.frames}x6 split frames')

    # 特写
    yaw.rotation_euler.z = math.radians(-25)
    hero_data = bpy.data.cameras.new('CamHero')
    hero_data.lens = 55
    hero = bpy.data.objects.new('CamHero', hero_data)
    bpy.context.collection.objects.link(hero)
    hero.location = (3.0, -3.2, 2.4)
    aim_at(hero, 0, 0, 0.4)
    scene.camera = hero
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.filepath = os.path.join(out_dir, 'hero.png')
    bpy.ops.render.render(write_still=True)
    print(f'[gen-enemies-3d] {etype}: hero done')

print('[gen-enemies-3d] ALL DONE')
