#!/usr/bin/env python3
"""星环防线 · 激光炮塔 3D 模型生成器（Blender headless）

用法:
  blender -b -P tools/gen-turret-3d.py -- [--out assets/turrets] [--frames 24] [--size 256]

产出:
  <out>/laser/frame_00..NN.png   炮口朝向 360° 旋转精灵帧（frame_00 朝屏幕上方）
  <out>/laser/hero.png           透视特写宣传图
  <out>/models/laser_turret.blend 源模型文件

美术风格对齐 src/game/render.ts 的 laser 塔：藏青金属六边形底座
(#16203A/#2E3D63)、青色 (#22E0FF) 发光描边、悬浮棱镜晶体与聚焦环。
"""
import bpy
import math
import os
import sys
import argparse

# ---------------- 参数 ----------------
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='assets/turrets')
ap.add_argument('--frames', type=int, default=24)
ap.add_argument('--size', type=int, default=256)
args = ap.parse_args(argv)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_DIR = os.path.normpath(os.path.join(ROOT, args.out)) if not os.path.isabs(args.out) else args.out
FRAME_DIR = os.path.join(OUT_DIR, 'laser')
MODEL_DIR = os.path.join(OUT_DIR, 'models')
os.makedirs(FRAME_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

CYAN = (0.133, 0.878, 1.0, 1.0)       # #22E0FF
NAVY = (0.086, 0.125, 0.227, 1.0)     # #16203A
NAVY_HI = (0.180, 0.239, 0.388, 1.0)  # #2E3D63
DARK = (0.039, 0.059, 0.125, 1.0)     # #0A0F20
STEEL = (0.42, 0.48, 0.60, 1.0)

# ---------------- 场景重置 ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = args.size
scene.render.resolution_y = args.size
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.render.image_settings.color_depth = '8'
scene.view_settings.look = 'AgX - Medium High Contrast'

# ---------------- 材质 ----------------
def mat_metal(name, color, metallic=0.9, roughness=0.32):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return m

def mat_glow(name, color, strength=6.0):
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

MAT_BASE = mat_metal('BaseNavy', NAVY)
MAT_BASE_HI = mat_metal('BaseNavyHi', NAVY_HI, metallic=0.85, roughness=0.28)
MAT_DARK = mat_metal('DeepSpace', DARK, metallic=0.8, roughness=0.4)
MAT_STEEL = mat_metal('Steel', STEEL, metallic=0.95, roughness=0.22)
MAT_GLOW = mat_glow('CyanGlow', CYAN, strength=4.0)
MAT_GLOW_SOFT = mat_glow('CyanGlowSoft', CYAN, strength=1.2)

# ---------------- 建模助手 ----------------
def add_cylinder(name, radius, depth, z, vertices=64, mat=None, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, z))
    ob = bpy.context.object
    ob.name = name
    if mat:
        ob.data.materials.append(mat)
    if bevel > 0:
        mod = ob.modifiers.new('EdgeBevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    return ob

def add_box(name, scale, loc, mat=None, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if mat:
        ob.data.materials.append(mat)
    if bevel > 0:
        mod = ob.modifiers.new('EdgeBevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    if parent:
        ob.parent = parent
    return ob

def hex_ring(name, r_out, r_in, depth, z, mat):
    """六边形环带（发光描边用）"""
    verts, faces = [], []
    for i in range(6):
        a = math.radians(60 * i + 30)
        verts.append((r_out * math.cos(a), r_out * math.sin(a), -depth / 2))
        verts.append((r_in * math.cos(a), r_in * math.sin(a), -depth / 2))
        verts.append((r_out * math.cos(a), r_out * math.sin(a), depth / 2))
        verts.append((r_in * math.cos(a), r_in * math.sin(a), depth / 2))
    for i in range(6):
        j = (i + 1) % 6
        o0, i0, o1, i1 = 4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3
        O0, I0, O1, I1 = 4 * j, 4 * j + 1, 4 * j + 2, 4 * j + 3
        faces += [
            (o0, O0, O1, o1),      # 外壁
            (i1, I1, I0, i0),      # 内壁
            (o1, O1, I1, i1),      # 顶面
            (o0, i0, I0, O0),      # 底面
        ]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.location.z = z
    ob.data.materials.append(mat)
    return ob

def add_octahedron(name, radius, loc, mat, parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=loc)
    ob = bpy.context.object
    ob.name = name
    # ico sphere(subdiv=1) 即正八面体，拉成菱形晶体
    ob.scale = (0.72, 0.72, 1.35)
    bpy.ops.object.transform_apply(scale=True)
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob

# ---------------- 底座（固定件） ----------------
base = add_cylinder('HexBase', 1.0, 0.30, 0.15, vertices=6, mat=MAT_BASE, bevel=0.05)
base.rotation_euler.z = math.radians(30)  # 平顶朝前，对齐 2D 版的六边形朝向

hex_ring('GlowRing', 1.02, 0.92, 0.06, 0.28, MAT_GLOW_SOFT)

deck = add_cylinder('Deck', 0.78, 0.10, 0.35, vertices=6, mat=MAT_BASE_HI, bevel=0.03)
deck.rotation_euler.z = math.radians(30)

# 三面护甲板（对应 2D 版 Lv2+ 装甲板）
for i in range(3):
    a = math.radians(120 * i + 30)
    plate = add_box(
        f'Armor{i}', (0.30, 0.10, 0.16),
        (0.82 * math.cos(a), 0.82 * math.sin(a), 0.28),
        mat=MAT_DARK, bevel=0.02,
    )
    plate.rotation_euler.z = a + math.pi / 2

# ---------------- 炮头（旋转件，挂 Yaw 空物体） ----------------
yaw = bpy.data.objects.new('Yaw', None)
bpy.context.collection.objects.link(yaw)

# 旋转座圈
race = add_cylinder('Race', 0.52, 0.12, 0.44, mat=MAT_STEEL, bevel=0.02)
race.parent = yaw
hex_ring('RaceGlow', 0.46, 0.40, 0.05, 0.50, MAT_GLOW).parent = yaw

# 炮塔主体（圆顶舱）
dome = add_cylinder('Dome', 0.42, 0.22, 0.60, mat=MAT_BASE_HI, bevel=0.06)
dome.parent = yaw
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.40, location=(0, 0, 0.70))
cap = bpy.context.object
cap.name = 'DomeCap'
cap.scale = (1.0, 1.0, 0.55)
bpy.ops.object.transform_apply(scale=True)
cap.data.materials.append(MAT_BASE)
cap.parent = yaw

# 双侧散热鳍
for sx in (-1, 1):
    fin = add_box(f'Fin{sx}', (0.10, 0.34, 0.14), (sx * 0.46, 0.06, 0.58),
                  mat=MAT_DARK, bevel=0.02, parent=yaw)
    stripe = add_box(f'FinGlow{sx}', (0.02, 0.30, 0.03), (sx * 0.55, 0.06, 0.62),
                     mat=MAT_GLOW_SOFT, parent=yaw)

# 炮管：朝 -Y（屏幕上方向），两级套管 + 炮口发光环
barrel = add_cylinder('Barrel', 0.11, 0.72, 0, vertices=24, mat=MAT_STEEL, bevel=0.02)
barrel.rotation_euler.x = math.radians(90)
barrel.location = (0, -0.52, 0.66)
barrel.parent = yaw

sleeve = add_cylinder('Sleeve', 0.16, 0.30, 0, vertices=24, mat=MAT_BASE, bevel=0.02)
sleeve.rotation_euler.x = math.radians(90)
sleeve.location = (0, -0.30, 0.66)
sleeve.parent = yaw

bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.035,
                                 major_segments=24, minor_segments=8,
                                 location=(0, -0.86, 0.66), rotation=(math.radians(90), 0, 0))
muzzle = bpy.context.object
muzzle.name = 'MuzzleGlow'
muzzle.data.materials.append(MAT_GLOW)
muzzle.parent = yaw

# 悬浮棱镜晶体（对应 2D 版的菱形晶体）+ 聚焦环
prism = add_octahedron('Prism', 0.20, (0, 0.18, 1.12), MAT_GLOW, parent=yaw)
prism.rotation_euler.z = math.radians(45)

bpy.ops.mesh.primitive_torus_add(major_radius=0.30, minor_radius=0.022,
                                 major_segments=32, minor_segments=8,
                                 location=(0, 0.18, 1.12))
ring = bpy.context.object
ring.name = 'FocusRing'
ring.rotation_euler.x = math.radians(20)
ring.data.materials.append(MAT_GLOW_SOFT)
ring.parent = yaw

# ---------------- 灯光 ----------------
def add_light(name, kind, loc, energy, color, size=1.0):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == 'AREA':
        data.shape = 'DISK'
        data.size = size
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    return ob

def aim_at(ob, tx=0.0, ty=0.0, tz=0.35):
    from mathutils import Vector
    direction = Vector((tx, ty, tz)) - ob.location
    ob.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

key = add_light('Key', 'AREA', (-3.5, -2.5, 6.0), 650, (1.0, 0.95, 0.88), size=4.0)
aim_at(key)
fill = add_light('Fill', 'AREA', (4.0, 1.5, 3.0), 380, (0.45, 0.62, 1.0), size=3.0)
aim_at(fill)
rim = add_light('Rim', 'AREA', (1.0, 4.5, 4.5), 700, (0.35, 0.85, 1.0), size=2.5)
aim_at(rim)

world = bpy.data.worlds.new('World')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.02, 0.03, 0.07, 1.0)
bg.inputs['Strength'].default_value = 0.35

# ---------------- 辉光合成 ----------------
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

# ---------------- 相机 ----------------
cam_data = bpy.data.cameras.new('CamOrtho')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 3.1
cam = bpy.data.objects.new('CamOrtho', cam_data)
bpy.context.collection.objects.link(cam)
# 俯视角 ~55°，从屏幕下方看向上方 → 炮管 -Y 即屏幕上方
elev = math.radians(55)
dist = 8.0
cam.location = (0, -dist * math.cos(elev), dist * math.sin(elev))
aim_at(cam, 0, 0, 0.42)
scene.camera = cam

# ---------------- 渲染 ----------------
# 保存源模型
blend_path = os.path.join(MODEL_DIR, 'laser_turret.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f'[gen-turret-3d] saved {blend_path}')

# 旋转精灵帧：frame_i = 炮管自屏幕上方顺时针 i*(360/N) 度
# （模型炮管朝 -Y 即屏幕下方，相机从 -Y 侧俯视；屏幕上顺时针 θ 对应世界 Z 轴旋转 180°-θ）
for i in range(args.frames):
    yaw.rotation_euler.z = math.radians(180.0 - (360.0 / args.frames) * i)
    scene.render.filepath = os.path.join(FRAME_DIR, f'frame_{i:02d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'[gen-turret-3d] frame {i + 1}/{args.frames}')

# 特写宣传图（透视 + 更低机位）
yaw.rotation_euler.z = math.radians(210)
hero_data = bpy.data.cameras.new('CamHero')
hero_data.lens = 55
hero = bpy.data.objects.new('CamHero', hero_data)
bpy.context.collection.objects.link(hero)
hero.location = (2.6, -3.4, 2.6)
aim_at(hero, 0, 0, 0.5)
scene.camera = hero
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.filepath = os.path.join(FRAME_DIR, 'hero.png')
bpy.ops.render.render(write_still=True)
print('[gen-turret-3d] hero.png done')
print('[gen-turret-3d] ALL DONE')
