#!/usr/bin/env python3
"""星环防线 · 恐怖版怪物 3D 模型生成器 v2（Blender headless，派生自 gen-enemies-3d.py）

用法:
  blender -b -P tools/gen-enemies-horror.py -- [--out assets/enemies-h] [--frames 16] [--size 192] [--only crawler]

产出（每种怪物）:
  <out>/<type>/walk/f<dir>_<phase>.png  朝向帧（dir 自 +X 顺时针，phase 4 帧步态循环）
  <out>/<type>/split/s<dir>_<phase>.png splitter 分裂帧（6 相位）
  <out>/<type>/hero.png                 透视特写
  <out>/models/<type>.blend             源模型

合成精灵表（ImageMagick montage；列序=相位、行序=朝向，与 render.ts 选帧一致）:
  MONTAGE="montage -font /System/Library/Fonts/Helvetica.ttc -geometry 192x192+0+0 -background none"
  $MONTAGE -tile 4x16 <type>/walk/f??_?.png <type>/sheet.png
  $MONTAGE -tile 6x16 splitter/split/s??_?.png splitter/split.png

v2 美术方向：《孤胆枪手》(Alien Shooter) 俯视血肉系 —
  油腻湿润肉质（暗红/暗粉血肉 roughness 0.22 + SSS，骨白角质，紫黑甲壳）、
  分段躯干与关节肢体（股节/胫节/爪尖）、獠牙倒刺钳爪、瘤结/血管/发光裂缝、
  强对比光影（暖白主光 vs 冷蓝紫轮廓光，补光压暗）。
  细节放大原则不变：192px 帧游戏内缩到 60-90px，尖刺 ≥ 体宽 1/4、眼睛多且大、发光强。
"""
import bpy
import math
import os
import sys
import argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='assets/enemies-h')
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

# 血肉系配色：flesh=暗红/暗粉血肉，carapace=紫黑甲壳，glow=生物光/裂缝色
ENEMIES = {
    'crawler':  {'flesh': '#8A2E3A', 'carapace': '#2E1A3E', 'glow': '#B8FF3D'},
    'speeder':  {'flesh': '#7A2E44', 'carapace': '#241A30', 'glow': '#B8FF3D'},
    'tanker':   {'flesh': '#6E2438', 'carapace': '#3A1F4A', 'glow': '#FF5A2E'},
    'splitter': {'flesh': '#B06A8A', 'carapace': '#4A2E5E', 'glow': '#B8FF3D'},
    'lurker':   {'flesh': '#6E2E3E', 'carapace': '#2A1638', 'glow': '#D0FF4D'},
    'miniboss': {'flesh': '#7A3A28', 'carapace': '#8A6A1E', 'glow': '#FFC94D'},
    'boss':     {'flesh': '#7A2440', 'carapace': '#33153F', 'glow': '#FF4D6E'},
}
# 体型缩放（同原版，细节放大但主体占帧约束不变）
SCALE = {'crawler': 1.0, 'speeder': 0.85, 'tanker': 1.15, 'splitter': 1.0, 'lurker': 0.9, 'miniboss': 1.35, 'boss': 1.55}

# ---------------- 材质 ----------------
def mat_flesh(name, color):
    # 湿润血肉：零金属、低粗糙出高光，次表面散射出肉感
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.22
    bsdf.inputs['Subsurface Weight'].default_value = 0.15
    return m

def mat_carapace(name, color):
    # 紫黑甲壳：硬表面但边缘光滑
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = 0.2
    bsdf.inputs['Roughness'].default_value = 0.32
    return m

def mat_bone(name):
    # 陈化骨/角质（象牙白偏灰）
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hex_rgba('#C9BFA8')
    bsdf.inputs['Metallic'].default_value = 0.05
    bsdf.inputs['Roughness'].default_value = 0.5
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

def mat_sac(name, color):
    # 半透明囊泡：透射 + 湿润高光，内部幼体隐约可见
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.18
    bsdf.inputs['Transmission Weight'].default_value = 0.55
    bsdf.inputs['IOR'].default_value = 1.38
    return m

# ---------------- 建模助手（有机化：光滑着色 + 细分） ----------------
def smooth(ob):
    for poly in ob.data.polygons:
        poly.use_smooth = True

def subsurf(ob, level=1):
    mod = ob.modifiers.new('Subsurf', 'SUBSURF')
    mod.subdivision_type = 'CATMULL_CLARK'
    mod.levels = level
    mod.render_levels = level + 1

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
    smooth(ob)
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob

def add_blob(name, loc, scale, mat, parent=None):
    """有机血肉块：ico 球 + 细分 + 光滑着色（消除低多边形几何感）"""
    ob = add_sphere(name, loc, scale, mat, parent, ico=True)
    subsurf(ob, 1)
    return ob

def add_cone(name, loc, r1, r2, depth, mat, parent=None, direction=None, verts=20):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc)
    ob = bpy.context.object
    ob.name = name
    smooth(ob)
    ob.data.materials.append(mat)
    if direction is not None:
        point_at(ob, direction)
    if parent:
        ob.parent = parent
    return ob

# 当前怪物的行走部件：[(hip_empty, phase_offset)]，逐怪物重置
WALK_PARTS = []
# 分裂体专用：[(lobe_root, side)] 与裂核，用于分裂动画
SPLIT_LOBES = []
SPLIT_CORE = None

def parent_keep(ob, parent):
    """挂到 parent 下且保持世界变换不变，之后移动 parent 可整体带动"""
    ob.parent = parent
    ob.matrix_parent_inverse = parent.matrix_world.inverted()

def add_legj(name, hip, side_dir, parent, mat, r_f=0.06, len_f=0.34, len_t=0.40, claw=0.16):
    """关节腿：股节（粗，外斜下）→ 胫节（细，垂直下）→ 爪尖（骨白）。
    整腿挂在 hip 空物体上，行走动画通过旋转 hip 实现"""
    hip_ob = bpy.data.objects.new(f'{name}_hip', None)
    bpy.context.collection.objects.link(hip_ob)
    hip_ob.location = hip
    hip_ob.parent = parent
    df = Vector(side_dir).normalized()
    knee = Vector(hip) + df * len_f
    femur = add_cone(f'{name}_femur', (Vector(hip) + knee) / 2, r_f, r_f * 0.45, len_f, mat, direction=df)
    femur.parent = hip_ob
    femur.matrix_parent_inverse = hip_ob.matrix_world.inverted()
    dt = Vector((df.x * 0.25, df.y * 0.25, -1.0)).normalized()
    ankle = knee + dt * len_t
    tibia = add_cone(f'{name}_tibia', (knee + ankle) / 2, r_f * 0.5, 0.015, len_t, mat, direction=dt)
    tibia.parent = hip_ob
    tibia.matrix_parent_inverse = hip_ob.matrix_world.inverted()
    if claw > 0:
        dc = Vector((df.x * 0.4, df.y * 0.4, -0.8)).normalized()
        claw_ob = add_cone(f'{name}_claw', ankle + dc * (claw / 2), 0.028, 0.003, claw, MATS['bone'], direction=dc)
        claw_ob.parent = hip_ob
        claw_ob.matrix_parent_inverse = hip_ob.matrix_world.inverted()
    return hip_ob

def legs_pair(prefix, xs, half_w, z, mat, parent, r_f=0.06, len_f=0.32, len_t=0.40):
    """两侧对称布关节腿；三角步态相位交错登记"""
    for si, sy in enumerate((-1, 1)):
        for i, x in enumerate(xs):
            hip = add_legj(f'{prefix}{sy}{i}', (x, sy * half_w, z),
                           (0.2 * (i - (len(xs) - 1) / 2), sy * 1.0, -0.55), parent, mat,
                           r_f=r_f, len_f=len_f, len_t=len_t)
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

def eye_row(prefix, base_x, base_z, n, spacing, r, mat, parent, sy=None):
    """一排复眼：沿头侧弧线布置（sy=None 时中线单排）"""
    for i in range(n):
        y = (sy if sy is not None else 0.0) * (0.10 + i * 0.012)
        x = base_x - i * spacing
        z = base_z + 0.02 * math.sin(i * 1.3)
        add_sphere(f'{prefix}{i}', (x, y, z), (r, r, r), mat, parent)

def dorsal_spikes(prefix, xs, z0, height0, mat, parent, lean=0.4, grade=0.12):
    """成排背刺：数量多、大小渐变、向后上方倾斜"""
    for i, x in enumerate(xs):
        h = height0 * (1 - grade * i)
        add_cone(f'{prefix}{i}', (x - 0.05, 0.05 * (1 if i % 2 else -1) * 0.5, z0 + h * 0.3),
                 0.06, 0.004, h, mat, parent,
                 direction=(-lean - i * 0.04, 0, 1.0))

def tumors(prefix, spots, mat, parent, glow_mat=None):
    """瘤结小球簇：血肉色为主，偶发发光脓点"""
    for i, (x, y, z, r) in enumerate(spots):
        m = glow_mat if (glow_mat is not None and i % 3 == 2) else mat
        add_blob(f'{prefix}{i}', (x, y, z), (r, r, r * 0.8), m, parent)

def wound(prefix, loc, scale, mat, parent):
    """伤口状发光裂缝：扁平发光嵌条"""
    add_sphere(prefix, loc, scale, mat, parent)

MATS = {}  # 当前怪物材质表（供 add_legj 爪尖取骨材质）

def aim_at(ob, tx=0.0, ty=0.0, tz=0.3):
    direction = Vector((tx, ty, tz)) - ob.location
    ob.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# ---------------- 七种恐怖怪物造型（朝 +X 为头） ----------------
def build_crawler(yaw, flesh, cara, glow, bone):
    # 多腭节肢 v2：三节血肉躯干（节间发光缝）+ 紫黑背甲 + 六条关节腿带爪 + 四腭口器 + 复眼排
    # 躯干三节串联（血肉），节间伤口裂缝发光
    add_blob('SegA', (0.22, 0, 0.44), (0.42, 0.40, 0.30), flesh, yaw)
    add_blob('SegB', (-0.16, 0, 0.42), (0.38, 0.42, 0.30), flesh, yaw)
    add_blob('SegC', (-0.50, 0, 0.40), (0.30, 0.34, 0.26), flesh, yaw)
    for i, (x, s) in enumerate([(0.02, 0.36), (-0.34, 0.30)]):
        wound(f'Seam{i}', (x, 0, 0.50 + 0.02 * i), (0.035, s, 0.05), glow, yaw)
    # 每节背甲 + 节上骨刺（双排渐变）
    for i, (x, s) in enumerate([(0.22, 0.40), (-0.16, 0.40), (-0.50, 0.30)]):
        add_blob(f'Plate{i}', (x, 0, 0.56 - 0.02 * i), (s, s * 0.95, 0.18), cara, yaw)
    dorsal_spikes('Spike', [0.30, 0.12, -0.06, -0.26, -0.44], 0.64, 0.40, bone, yaw, lean=0.45)
    # 头 + 四根分腭口器 + 大獠牙 + 每侧 4 复眼
    add_blob('Head', (0.60, 0, 0.40), (0.32, 0.32, 0.24), flesh, yaw)
    add_blob('HeadPlate', (0.58, 0, 0.50), (0.28, 0.30, 0.14), cara, yaw)
    for sy in (-1, 1):
        eye_row(f'Eye{sy}_', 0.86, 0.50, 4, 0.09, 0.055, glow, yaw, sy=sy)
        add_cone(f'Fang{sy}', (0.90, sy * 0.14, 0.26), 0.06, 0.008, 0.34, bone, yaw,
                 direction=(0.8, -sy * 0.3, -0.6))
        for j in range(2):
            add_cone(f'Palp{sy}{j}', (0.84 + j * 0.06, sy * (0.20 + j * 0.08), 0.32),
                     0.04, 0.006, 0.26, flesh, yaw,
                     direction=(0.85, sy * 0.5, -0.35 - j * 0.15))
    # 瘤结簇（腹侧）
    tumors('Tumor', [(-0.30, 0.34, 0.34, 0.09), (-0.42, 0.28, 0.30, 0.07), (-0.22, 0.38, 0.28, 0.06)], flesh, yaw, glow)
    legs_pair('Leg', [0.34, 0.02, -0.30], 0.38, 0.42, cara, yaw, r_f=0.065, len_f=0.34, len_t=0.42)

def build_speeder(yaw, flesh, cara, glow, bone):
    # 骨刃镰肢 v2：三节流线躯干 + 两节骨镰（股段+刃段带倒刺）+ 分节长尾刺 + 背鳍刺排
    add_blob('SegA', (0.30, 0, 0.38), (0.36, 0.24, 0.20), flesh, yaw)
    add_blob('SegB', (-0.06, 0, 0.38), (0.34, 0.26, 0.20), flesh, yaw)
    add_blob('SegC', (-0.42, 0, 0.40), (0.26, 0.22, 0.17), flesh, yaw)
    wound('SeamA', (0.12, 0, 0.42), (0.03, 0.22, 0.05), glow, yaw)
    for sy in (-1, 1):
        add_sphere(f'Stripe{sy}', (0.05, sy * 0.24, 0.40), (0.40, 0.035, 0.05), glow, yaw)
    # 背鳍刺（6 根渐变，骨白）
    dorsal_spikes('Fin', [0.30, 0.14, -0.02, -0.18, -0.34, -0.48], 0.54, 0.30, bone, yaw, lean=0.55, grade=0.10)
    # 头 + 复眼
    add_blob('Head', (0.66, 0, 0.36), (0.26, 0.20, 0.17), flesh, yaw)
    add_blob('HeadPlate', (0.64, 0, 0.44), (0.22, 0.20, 0.10), cara, yaw)
    for sy in (-1, 1):
        eye_row(f'Eye{sy}_', 0.86, 0.44, 3, 0.07, 0.05, glow, yaw, sy=sy)
        # 两节骨镰：股段前伸 + 刃段上勾，刃背两根倒刺
        add_cone(f'ScytheA{sy}', (0.86, sy * 0.22, 0.42), 0.065, 0.03, 0.5, bone, yaw,
                 direction=(0.75, sy * 0.45, 0.15))
        add_cone(f'ScytheB{sy}', (1.16, sy * 0.40, 0.52), 0.032, 0.004, 0.44, bone, yaw,
                 direction=(0.3, sy * 0.2, 1.0))
        for j in range(2):
            add_cone(f'Barb{sy}{j}', (1.06 + j * 0.10, sy * (0.34 + j * 0.05), 0.56 + j * 0.06),
                     0.02, 0.003, 0.14, bone, yaw,
                     direction=(-0.3, sy * 0.5, 0.8))
    # 分节长尾：两节血肉 + 骨白毒刺尖（发光毒囊）
    add_blob('TailA', (-0.70, 0, 0.46), (0.18, 0.14, 0.12), flesh, yaw)
    add_cone('TailB', (-0.92, 0, 0.54), 0.07, 0.02, 0.4, flesh, yaw, direction=(-0.9, 0, 0.5))
    add_sphere('VenomSac', (-1.06, 0, 0.62), (0.08, 0.08, 0.08), glow, yaw)
    add_cone('Sting', (-1.16, 0, 0.68), 0.04, 0.003, 0.28, bone, yaw, direction=(-0.7, 0, 0.65))
    legs_pair('Leg', [0.30, -0.14], 0.24, 0.38, cara, yaw, r_f=0.045, len_f=0.30, len_t=0.42)

def build_tanker(yaw, flesh, cara, glow, bone):
    # 瘤状甲壳 v2：血肉底盘 + 三块紫黑叠甲（甲缘露血肉缝）+ 熔岩裂纹 + 瘤结簇 + 粗关节腿
    add_blob('Core', (0, 0, 0.40), (0.60, 0.54, 0.34), flesh, yaw)
    # 甲壳下缘血肉接缝（发光熔岩缝）
    for i, ox in enumerate((0.16, -0.14)):
        wound(f'Seam{i}', (ox, 0, 0.50), (0.04, 0.50, 0.05), glow, yaw)
    for sy in (-1, 1):
        wound(f'SeamSide{sy}', (0.0, sy * 0.46, 0.46), (0.40, 0.04, 0.05), glow, yaw)
    # 三块叠甲（细分圆滑）+ 甲顶熔岩裂纹（低强度发光，避免 AgX 洗成白十字；错位短缝更像裂口）
    crack = mat_glow('Crack', hex_rgba('#FF5A2E'), strength=2.8)
    for i, (ox, s) in enumerate([(0.28, 0.50), (-0.02, 0.58), (-0.32, 0.46)]):
        add_blob(f'Plate{i}', (ox, 0, 0.56 + 0.03 * (1 - abs(i - 1))), (s, 0.56 - 0.04 * abs(i - 1), 0.24), cara, yaw)
    wound('CrackTopA', (0.10, 0.10, 0.84), (0.26, 0.045, 0.03), crack, yaw)
    wound('CrackTopB', (-0.22, -0.12, 0.82), (0.20, 0.045, 0.03), crack, yaw)
    wound('CrackX', (0.16, 0.06, 0.80), (0.04, 0.30, 0.03), crack, yaw)
    # 瘤结簇（背甲两侧 + 肩头，含发光脓点）
    tumors('Tumor', [(0.30, 0.36, 0.60, 0.11), (0.30, -0.36, 0.60, 0.11), (-0.08, 0.44, 0.52, 0.09),
                     (-0.08, -0.44, 0.52, 0.09), (-0.36, 0.32, 0.56, 0.08), (-0.36, -0.32, 0.56, 0.08),
                     (0.14, 0.48, 0.42, 0.07), (0.14, -0.48, 0.42, 0.07)], flesh, yaw, glow)
    # 背甲骨刺（双排渐变）
    dorsal_spikes('Spike', [0.10, -0.08, -0.26, -0.42], 0.82, 0.32, bone, yaw, lean=0.5)
    # 头 + 小眼簇（5 只）+ 獠牙
    add_blob('Head', (0.64, 0, 0.38), (0.26, 0.28, 0.20), flesh, yaw)
    add_blob('HeadPlate', (0.62, 0, 0.48), (0.22, 0.26, 0.12), cara, yaw)
    for sy in (-1, 1):
        eye_row(f'Eye{sy}_', 0.86, 0.44, 2, 0.08, 0.05, glow, yaw, sy=sy)
        add_cone(f'Tusk{sy}', (0.88, sy * 0.18, 0.28), 0.06, 0.008, 0.32, bone, yaw,
                 direction=(0.85, -sy * 0.2, -0.45))
    add_sphere('EyeC', (0.78, 0, 0.54), (0.055, 0.055, 0.05), glow, yaw)
    legs_pair('Leg', [0.22, -0.27], 0.50, 0.38, flesh, yaw, r_f=0.09, len_f=0.30, len_t=0.36)

def build_splitter(yaw, flesh, cara, glow, bone):
    # 半透明囊泡 v2：囊体内蜷缩幼体（血肉躯体+发光核+小肢体）+ 表面血管网 + 关节腿
    global SPLIT_CORE
    for sy in (-1, 1):
        root = bpy.data.objects.new(f'LobeRoot{sy}', None)
        bpy.context.collection.objects.link(root)
        root.parent = yaw
        SPLIT_LOBES.append((root, sy))
        sac = mat_sac(f'Sac{sy}', hex_rgba('#C98CA8'))
        parent_keep(add_blob(f'Lobe{sy}', (0, sy * 0.22, 0.42), (0.58, 0.33, 0.37), sac), root)
        # 蜷缩幼体：血肉身 + 发光核 + 两只小眼 + 蜷尾
        parent_keep(add_blob(f'Larva{sy}', (0.05, sy * 0.22, 0.38), (0.20, 0.15, 0.14), flesh), root)
        parent_keep(add_sphere(f'LarvaCore{sy}', (0.08, sy * 0.22, 0.40), (0.10, 0.08, 0.08), glow), root)
        parent_keep(add_sphere(f'LarvaEye{sy}', (0.20, sy * 0.24, 0.44), (0.04, 0.04, 0.04), glow), root)
        parent_keep(add_blob(f'LarvaTail{sy}', (-0.12, sy * 0.26, 0.44), (0.11, 0.08, 0.08), flesh), root)
        parent_keep(add_sphere(f'Eye{sy}', (0.52, sy * 0.32, 0.50), (0.06, 0.06, 0.06), glow), root)
        # 囊泡表面血管（发光纹，两条）
        for j in range(2):
            parent_keep(add_sphere(f'Vein{sy}{j}', (0.02 + j * 0.14, sy * 0.40, 0.52 - j * 0.08),
                                   (0.26, 0.025, 0.035), glow), root)
        for i, x in enumerate([0.16, -0.22]):
            hip = add_legj(f'Leg{sy}{i}', (x, sy * 0.42, 0.38),
                           (0.15 * (i - 0.5), sy * 1.0, -0.55), root, cara, r_f=0.05, len_f=0.30, len_t=0.40)
            WALK_PARTS.append((hip, 0.0 if (i % 2 == 0) == (sy > 0) else math.pi))
    SPLIT_CORE = add_sphere('Core', (0.1, 0, 0.50), (0.34, 0.17, 0.25), glow, yaw)

def build_lurker(yaw, flesh, cara, glow, bone):
    # 巨口倒钩 v2：上下两腭巨口（发光喉腔 + 双排倒钩牙）+ 骨指翼膜 + 分节尾刺 + 背棘排
    add_blob('SegA', (0.10, 0, 0.40), (0.36, 0.22, 0.20), flesh, yaw)
    add_blob('SegB', (-0.28, 0, 0.40), (0.30, 0.20, 0.17), flesh, yaw)
    wound('SeamA', (-0.10, 0, 0.46), (0.03, 0.18, 0.04), glow, yaw)
    # 上腭头甲 + 下腭（巨口结构）
    add_blob('UpperJaw', (0.56, 0, 0.50), (0.28, 0.20, 0.14), cara, yaw)
    add_blob('LowerJaw', (0.58, 0, 0.30), (0.26, 0.18, 0.10), flesh, yaw)
    add_sphere('Maw', (0.72, 0, 0.40), (0.13, 0.12, 0.10), glow, yaw)
    # 双排倒钩牙：上排向下扣、下排向上扣
    for i in range(5):
        y = (i - 2) * 0.075
        add_cone(f'ToothU{i}', (0.82, y, 0.48 - 0.012 * abs(i - 2)), 0.028, 0.004, 0.17, bone, yaw,
                 direction=(0.25, y * 1.2, -1.0))
        add_cone(f'ToothL{i}', (0.82, y, 0.32 + 0.012 * abs(i - 2)), 0.024, 0.004, 0.14, bone, yaw,
                 direction=(0.25, y * 1.2, 1.0))
    for sy in (-1, 1):
        eye_row(f'Eye{sy}_', 0.62, 0.58, 3, 0.07, 0.045, glow, yaw, sy=sy)
        # 翼膜：血肉膜 + 两根骨指撑开
        add_box(f'Membrane{sy}', (0.40, 0.28, 0.015), (-0.18, sy * 0.40, 0.52), flesh, yaw,
                rot_z=math.radians(-24 * sy), rot_y=math.radians(-6))
        add_cone(f'WingFinger{sy}0', (-0.28, sy * 0.56, 0.54), 0.025, 0.004, 0.30, bone, yaw,
                 direction=(-0.4, sy * 0.85, 0.25))
        add_cone(f'WingFinger{sy}1', (-0.05, sy * 0.60, 0.56), 0.022, 0.004, 0.26, bone, yaw,
                 direction=(-0.05, sy * 0.95, 0.2))
    # 背棘排（6 根渐变）+ 分节尾刺
    dorsal_spikes('Spike', [0.24, 0.08, -0.08, -0.24, -0.38], 0.58, 0.40, bone, yaw, lean=0.5, grade=0.11)
    add_blob('TailA', (-0.56, 0, 0.44), (0.16, 0.12, 0.10), flesh, yaw)
    add_cone('TailSting', (-0.78, 0, 0.54), 0.05, 0.004, 0.42, glow, yaw, direction=(-0.85, 0, 0.5))
    legs_pair('Leg', [0.22, -0.16], 0.20, 0.38, cara, yaw, r_f=0.045, len_f=0.30, len_t=0.42)

def build_miniboss(yaw, flesh, cara, glow, bone):
    # 掠晶兽 v2：血肉底盘 + 金晶甲碎片簇生（9 根参差晶刺）+ 三感知眼 + 裂核胸口 + 晶刃尾
    add_blob('Core', (0, 0, 0.48), (0.64, 0.54, 0.34), flesh, yaw)
    wound('SeamA', (0.10, 0, 0.50), (0.04, 0.42, 0.05), glow, yaw)
    # 晶甲碎片板（棱角但光滑边）
    for i, (ox, s) in enumerate([(0.28, 0.50), (-0.04, 0.56), (-0.34, 0.44)]):
        add_blob(f'Plate{i}', (ox, 0, 0.58 + 0.03 * (1 - abs(i - 1))), (s, 0.54 - 0.05 * abs(i - 1), 0.22), cara, yaw)
    # 晶刺簇：9 根长短参差、角度歪斜（金晶 = carapace 色发光弱化，用 glow 混排）
    for i in range(9):
        x = 0.34 - i * 0.11
        sy = ((i % 3) - 1) * 0.15
        h = 0.60 if i % 2 == 0 else 0.40
        m = glow if i % 3 == 1 else cara
        add_cone(f'Crystal{i}', (x - 0.04, sy, 0.84 - i * 0.006), 0.075, 0.004, h, m, yaw,
                 direction=(-0.45 - i * 0.03, sy * 1.4, 1.0))
    # 头 + 三感知眼（品字，更大更亮）+ 獠牙
    add_blob('Head', (0.70, 0, 0.46), (0.28, 0.30, 0.22), flesh, yaw)
    add_blob('HeadPlate', (0.68, 0, 0.58), (0.24, 0.28, 0.12), cara, yaw)
    for sy in (-1, 1):
        add_sphere(f'Eye{sy}', (0.92, sy * 0.18, 0.54), (0.075, 0.075, 0.075), glow, yaw)
        add_cone(f'Fang{sy}', (0.94, sy * 0.16, 0.30), 0.06, 0.008, 0.32, bone, yaw,
                 direction=(0.85, -sy * 0.25, -0.5))
    add_sphere('EyeC', (0.84, 0, 0.68), (0.09, 0.09, 0.07), glow, yaw)
    # 瘤结 + 胸口裂核（大核 + 放射裂纹）
    tumors('Tumor', [(-0.30, 0.36, 0.44, 0.09), (-0.30, -0.36, 0.44, 0.09)], flesh, yaw, glow)
    add_sphere('ChestCore', (0.66, 0, 0.34), (0.13, 0.13, 0.11), glow, yaw)
    wound('ChestCrack', (0.52, 0, 0.40), (0.28, 0.05, 0.04), glow, yaw)
    # 分节尾 + 晶刃
    add_blob('TailA', (-0.68, 0, 0.52), (0.16, 0.13, 0.11), flesh, yaw)
    add_cone('TailBlade', (-0.88, 0, 0.60), 0.07, 0.004, 0.5, glow, yaw, direction=(-0.9, 0, 0.4))
    legs_pair('Leg', [0.34, -0.02, -0.36], 0.50, 0.42, flesh, yaw, r_f=0.075, len_f=0.32, len_t=0.40)

def build_boss(yaw, flesh, cara, glow, bone):
    # 湮灭巨兽 v2：三节巨型血肉躯干 + 紫黑重甲 + 骨刺冠冕（每侧三根）+ 下颌两节触须
    #   + 胸口裂口熔核（放射裂纹）+ 发光棘/骨刺交错背脊
    add_blob('SegA', (0.30, 0, 0.60), (0.56, 0.56, 0.38), flesh, yaw)
    add_blob('SegB', (-0.20, 0, 0.58), (0.52, 0.58, 0.36), flesh, yaw)
    add_blob('SegC', (-0.62, 0, 0.54), (0.40, 0.46, 0.30), flesh, yaw)
    # 节间熔岩裂缝
    for i, (x, s) in enumerate([(0.04, 0.52), (-0.42, 0.42)]):
        wound(f'Seam{i}', (x, 0, 0.66), (0.045, s, 0.06), glow, yaw)
    # 重甲板（细分圆滑）
    for i, (ox, s) in enumerate([(0.32, 0.56), (-0.02, 0.66), (-0.40, 0.52)]):
        add_blob(f'Plate{i}', (ox, 0, 0.74), (s, 0.62, 0.26), cara, yaw)
    # 背脊：发光棘与骨刺交错（8 根渐变）
    for i in range(8):
        x = 0.30 - i * 0.16
        h = 0.46 if i % 2 else 0.38
        m = bone if i % 2 else glow
        add_cone(f'BackSpike{i}', (x - 0.04, 0.06 * (1 if i % 3 == 0 else -1), 0.92 - i * 0.008),
                 0.065, 0.004, h, m, yaw, direction=(-0.4, 0.05, 1.0))
    # 头 + 骨刺冠冕 + 下颌触须（两节）+ 复眼排
    add_blob('Head', (0.86, 0, 0.56), (0.36, 0.38, 0.28), flesh, yaw)
    add_blob('HeadPlate', (0.84, 0, 0.70), (0.30, 0.34, 0.14), cara, yaw)
    for sy in (-1, 1):
        eye_row(f'Eye{sy}_', 1.12, 0.66, 3, 0.08, 0.07, glow, yaw, sy=sy)
        add_cone(f'HornA{sy}', (1.00, sy * 0.26, 0.98), 0.11, 0.04, 0.58, bone, yaw,
                 direction=(0.45, sy * 0.18, 1.0))
        add_cone(f'HornB{sy}', (1.16, sy * 0.34, 1.38), 0.055, 0.004, 0.48, bone, yaw,
                 direction=(0.15, sy * 0.12, 1.0))
        add_cone(f'HornC{sy}', (0.80, sy * 0.34, 1.06), 0.08, 0.01, 0.44, bone, yaw,
                 direction=(-0.1, sy * 0.3, 1.0))
        # 下颌两节触须
        for j in range(2):
            add_cone(f'Tent{sy}{j}A', (1.00 + j * 0.10, sy * (0.14 + j * 0.10), 0.28),
                     0.05, 0.02, 0.26, flesh, yaw,
                     direction=(0.4 - j * 0.2, sy * 0.25, -1.0))
            add_cone(f'Tent{sy}{j}B', (1.06 + j * 0.06, sy * (0.18 + j * 0.10), 0.08),
                     0.02, 0.004, 0.22, flesh, yaw,
                     direction=(0.2 - j * 0.2, sy * 0.3, -1.0))
    # 胸口裂口熔核 + 三条放射裂纹
    add_sphere('ChestCore', (1.04, 0, 0.42), (0.20, 0.20, 0.16), glow, yaw)
    for i, dz in enumerate((0.18, -0.02, -0.20)):
        wound(f'Crack{i}', (0.88, 0, 0.42 + dz), (0.26 - 0.04 * i, 0.05, 0.035), glow, yaw)
    # 肩部骨刺 + 瘤结
    for sy in (-1, 1):
        add_cone(f'Shoulder{sy}', (0.30, sy * 0.58, 0.80), 0.09, 0.008, 0.44, bone, yaw,
                 direction=(0.1, sy * 0.65, 0.75))
    tumors('Tumor', [(-0.55, 0.40, 0.66, 0.10), (-0.55, -0.40, 0.66, 0.10)], flesh, yaw, glow)
    legs_pair('Leg', [0.42, 0.0, -0.42], 0.62, 0.48, flesh, yaw, r_f=0.095, len_f=0.36, len_t=0.44)

BUILDERS = {
    'crawler': build_crawler, 'speeder': build_speeder, 'tanker': build_tanker,
    'splitter': build_splitter, 'lurker': build_lurker, 'miniboss': build_miniboss, 'boss': build_boss,
}

# ---------------- 灯光/相机/合成（强对比：暖主光 vs 冷轮廓光） ----------------
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

    # 暖白主光（肉质高光）+ 冷蓝紫轮廓光（剪影分离）+ 压暗补光（保留阴影）
    add_light('Key', (-3.5, -2.5, 6.0), 520, (1.0, 0.85, 0.70), size=3.0)
    add_light('Fill', (4.0, 1.5, 3.0), 110, (0.35, 0.35, 0.60), size=3.0)
    add_light('Rim', (1.0, 4.5, 4.5), 520, (0.45, 0.45, 1.0), size=2.5)

    world = bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.03, 0.07, 1.0)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.25

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

    flesh = mat_flesh('Flesh', hex_rgba(cfg['flesh']))
    cara = mat_carapace('Carapace', hex_rgba(cfg['carapace']))
    glow = mat_glow('Glow', hex_rgba(cfg['glow']), strength=5.0)
    bone = mat_bone('Bone')
    MATS.clear()
    MATS.update({'flesh': flesh, 'cara': cara, 'glow': glow, 'bone': bone})
    WALK_PARTS.clear()
    SPLIT_LOBES.clear()
    SPLIT_CORE = None
    BUILDERS[etype](yaw, flesh, cara, glow, bone)

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
    print(f'[gen-enemies-horror] {etype}: {args.frames}x4 frames')

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
                SPLIT_CORE.location.z = 0.50 - 0.1 * t
                scene.render.filepath = os.path.join(split_dir, f's{i:02d}_{p}.png')
                bpy.ops.render.render(write_still=True)
        # 复位供特写使用
        for root, sy in SPLIT_LOBES:
            root.location = (0, 0, 0)
            root.rotation_euler = (0, 0, 0)
            root.scale = (1, 1, 1)
        SPLIT_CORE.scale = (1, 1, 1)
        SPLIT_CORE.location.z = 0.50
        print(f'[gen-enemies-horror] splitter: {args.frames}x6 split frames')

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
    print(f'[gen-enemies-horror] {etype}: hero done')

print('[gen-enemies-horror] ALL DONE')
