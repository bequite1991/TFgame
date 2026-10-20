#!/usr/bin/env python3
"""星环防线 · 全炮塔 3D 模型生成器（Blender headless）

用法:
  blender -b -P tools/gen-towers-3d.py -- [--out assets/turrets] [--dirs 24] [--size 192] [--only laser]

产出（每种塔）:
  <out>/<type>/walk/f<dir>_<phase>.png  中间帧（dir 自屏幕上方顺时针，phase 4 帧待机循环）
  <out>/<type>/hero.png                 透视特写
  <out>/models/<type>.blend             源模型
  合成精灵表（montage，4 列相位 × 24 行朝向）见 README 或 tools 文档

美术风格对齐 src/game/render.ts：藏青六边形底座 + 主题色染色甲板 + 大轮廓顶部。
发光强度刻意压低（AgX + 辉光会吃色），保证小尺寸下主题色可辨。
朝向约定：炮口建模朝 -Y（屏幕下方），dir=0 时 yaw 旋转 180° 使炮口朝屏幕上方，
与 drawTower 的 aimAngle（0=朝上、顺时针）一致。
"""
import bpy
import math
import os
import sys
import argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='assets/turrets')
ap.add_argument('--dirs', type=int, default=24)
ap.add_argument('--size', type=int, default=192)
ap.add_argument('--only', default=None)
args = ap.parse_args(argv)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_DIR = os.path.normpath(os.path.join(ROOT, args.out)) if not os.path.isabs(args.out) else args.out
MODEL_DIR = os.path.join(OUT_DIR, 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

def hex_rgba(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)

def mix(c1, c2, t):
    return tuple(c1[i] * (1 - t) + c2[i] * t for i in range(3)) + (1.0,)

# 与 src/game/config.ts TOWERS 一致
TOWERS = {
    'laser':   {'color': '#22E0FF'},
    'missile': {'color': '#FF9F43'},
    'frost':   {'color': '#3DF08C'},
    'railgun': {'color': '#8B5CF6'},
    'tesla':   {'color': '#FFE93D'},
    'plasma':  {'color': '#FF6B3D'},
}
NAVY = hex_rgba('#16203A')
NAVY_HI = hex_rgba('#2E3D63')
DARK = hex_rgba('#0A0F20')
STEEL = hex_rgba('#6B7A99')

# ---------------- 材质/建模助手 ----------------
def mat_metal(name, color, metallic=0.85, roughness=0.32):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return m

def mat_glow(name, color, strength=2.8):
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

def mat_crystal(name, color):
    # 实体晶体质感：饱和底色 + 弱自发光，避免纯发光被 AgX 洗白
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = 0.1
    bsdf.inputs['Roughness'].default_value = 0.15
    bsdf.inputs['Emission Color'].default_value = color
    bsdf.inputs['Emission Strength'].default_value = 1.1
    return m

def add_cylinder(name, radius, depth, z, vertices=64, mat=None, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, z))
    ob = bpy.context.object
    ob.name = name
    if mat:
        ob.data.materials.append(mat)
    if bevel > 0:
        mod = ob.modifiers.new('EdgeBevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    if parent:
        ob.parent = parent
    return ob

def add_box(name, scale, loc, mat=None, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        ob.data.materials.append(mat)
    if bevel > 0:
        mod = ob.modifiers.new('EdgeBevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    if parent:
        ob.parent = parent
    return ob

def add_sphere(name, loc, scale, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=28, ring_count=14, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob

def add_torus(name, loc, major, minor, mat, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=28, minor_segments=8,
                                     location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob

def add_cone(name, loc, r1, r2, depth, mat, parent=None, direction=None):
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=r1, radius2=r2, depth=depth, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    if direction is not None:
        ob.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()
    if parent:
        ob.parent = parent
    return ob

def add_octahedron(name, radius, loc, mat, parent=None, squash=(0.72, 0.72, 1.35)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = squash
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob

def hex_ring(name, r_out, r_in, depth, z, mat, parent=None):
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
        faces += [(o0, O0, O1, o1), (i1, I1, I0, i0), (o1, O1, I1, i1), (o0, i0, I0, O0)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.location.z = z
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob

def aim_at(ob, tx=0.0, ty=0.0, tz=0.4):
    direction = Vector((tx, ty, tz)) - ob.location
    ob.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# ---------------- 共用底座（甲板染主题色）+ 旋转座圈 ----------------
def build_base(yaw, mats):
    base = add_cylinder('HexBase', 1.0, 0.30, 0.15, vertices=6, mat=mats['navy'], bevel=0.05)
    base.rotation_euler.z = math.radians(30)
    hex_ring('GlowRing', 1.02, 0.92, 0.06, 0.28, mats['glow_soft'])
    deck = add_cylinder('Deck', 0.78, 0.10, 0.35, vertices=6, mat=mats['deck'], bevel=0.03)
    deck.rotation_euler.z = math.radians(30)
    for i in range(3):
        a = math.radians(120 * i + 30)
        plate = add_box(f'Armor{i}', (0.30, 0.10, 0.16),
                        (0.82 * math.cos(a), 0.82 * math.sin(a), 0.28), mat=mats['dark'], bevel=0.02)
        plate.rotation_euler.z = a + math.pi / 2
    # 旋转座圈（挂 yaw，随炮头转）
    add_cylinder('Race', 0.52, 0.12, 0.44, mat=mats['steel'], bevel=0.02, parent=yaw)
    hex_ring('RaceGlow', 0.46, 0.40, 0.05, 0.50, mats['glow'], parent=yaw)

# ---------------- 各塔顶部（炮口朝 -Y；返回待机动画部件表） ----------------
def top_laser(yaw, m):
    # 光棱塔：小云台 + 炮管 + 高耸青色光棱晶柱（主识别：尖塔轮廓）
    add_cylinder('Dome', 0.40, 0.20, 0.58, mat=m['navy_hi'], bevel=0.06, parent=yaw)
    add_sphere('DomeCap', (0, 0, 0.66), (0.38, 0.38, 0.20), m['navy'], yaw)
    barrel = add_cylinder('Barrel', 0.10, 0.62, 0.62, vertices=24, mat=m['steel'], bevel=0.02, parent=yaw)
    barrel.rotation_euler.x = math.radians(90)
    barrel.location.y = -0.44
    sleeve = add_cylinder('Sleeve', 0.15, 0.28, 0.62, vertices=24, mat=m['navy'], bevel=0.02, parent=yaw)
    sleeve.rotation_euler.x = math.radians(90)
    sleeve.location.y = -0.24
    add_torus('MuzzleGlow', (0, -0.74, 0.62), 0.11, 0.032, m['glow'], yaw, rot=(math.radians(90), 0, 0))
    spire = add_octahedron('Spire', 0.30, (0, 0.14, 1.04), m['glow'], yaw, squash=(0.75, 0.75, 1.9))
    spire.rotation_euler.z = math.radians(45)
    add_torus('FocusRing', (0, 0.14, 0.92), 0.34, 0.026, m['glow_soft'], yaw, rot=(math.radians(70), 0, 0))
    return {'prism': spire, 'prism_z': 1.04}

def anim_laser(a, ph):
    a['prism'].location.z = a['prism_z'] + 0.05 * math.sin(ph)

def top_missile(yaw, m):
    # 火箭巢：四联装大口径发射筒外倾 40° + 醒目浅色弹头（主识别：V 形弹巢）
    add_cylinder('Platform', 0.46, 0.16, 0.56, mat=m['deck'], bevel=0.04, parent=yaw)
    lamps = []
    for i in range(4):
        a = math.radians(90 * i + 45)
        px, py = 0.20 * math.cos(a), 0.20 * math.sin(a)
        out = (0.85 * math.cos(a), 0.85 * math.sin(a), 1.0)
        add_cone(f'Tube{i}', (px + out[0] * 0.14, py + out[1] * 0.14, 0.80), 0.18, 0.145, 0.52,
                 m['navy'], yaw, direction=out)
        # 弹头（露出筒口）
        tip_loc = (px + out[0] * 0.40, py + out[1] * 0.40, 0.80 + 0.26)
        add_cone(f'Missile{i}', tip_loc, 0.115, 0.015, 0.34, m['warhead'], yaw, direction=out)
        lamp = add_sphere(f'Lamp{i}', (0.42 * math.cos(a - 0.4), 0.42 * math.sin(a - 0.4), 0.62),
                          (0.055, 0.055, 0.055), m['warn'], yaw)
        lamps.append(lamp)
    return {'lamps': lamps}

def anim_missile(a, ph):
    s = 1.0 + 0.35 * max(0.0, math.sin(ph))
    for lamp in a['lamps']:
        lamp.scale = (s, s, s)

def top_frost(yaw, m):
    # 冰晶簇：主冰晶 + 两根外倾侧晶（主识别：锯齿状晶簇轮廓）
    add_cylinder('Pedestal', 0.38, 0.22, 0.58, mat=m['navy_hi'], bevel=0.05, parent=yaw)
    hex_ring('FrostRing', 0.42, 0.35, 0.05, 0.70, m['glow_soft'], parent=yaw)
    main = add_octahedron('CrystalMain', 0.34, (0, 0, 0.92), m['crystal'], yaw, squash=(0.75, 0.75, 1.7))
    shards = []
    for sx in (-1, 1):
        s = add_octahedron(f'Shard{sx}', 0.19, (sx * 0.26, 0, 0.80), m['crystal'], yaw, squash=(0.62, 0.62, 1.6))
        s.rotation_euler.y = math.radians(sx * 18)
        shards.append(s)
    ring1 = add_torus('Ring1', (0, 0, 0.82), 0.46, 0.016, m['glow_soft'], yaw, rot=(math.radians(65), 0, 0))
    return {'crystal': main, 'shards': shards, 'ring1': ring1}

def anim_frost(a, ph):
    a['crystal'].location.z = 0.92 + 0.06 * math.sin(ph)
    for i, s in enumerate(a['shards']):
        s.location.z = 0.80 + 0.05 * math.sin(ph + i * 2.1)
    a['ring1'].rotation_euler.z = ph * 0.25

def top_railgun(yaw, m):
    # 磁轨炮：超长双轨（发光轨道条为主视觉）伸出底座 + 尾部电容舱 + 炮口光环
    add_cylinder('Mount', 0.42, 0.18, 0.56, mat=m['navy_hi'], bevel=0.04, parent=yaw)
    add_box('Capacitor', (0.34, 0.28, 0.22), (0, 0.30, 0.78), m['navy'], 0.03, yaw)
    add_box('CapGlow', (0.36, 0.10, 0.05), (0, 0.30, 0.92), m['glow'], 0, yaw)
    for sx in (-1, 1):
        add_box(f'Rail{sx}', (0.12, 0.78, 0.12), (sx * 0.20, -0.32, 0.80), m['steel'], 0.02, yaw)
        add_box(f'RailGlow{sx}', (0.05, 0.74, 0.04), (sx * 0.20, -0.32, 0.90), m['glow'], 0, yaw)
    add_box('Muzzle', (0.28, 0.12, 0.18), (0, -1.02, 0.80), m['dark'], 0.02, yaw)
    ring = add_torus('MuzzleRing', (0, -1.06, 0.80), 0.16, 0.032, m['glow'], yaw, rot=(math.radians(90), 0, 0))
    return {'ring': ring}

def anim_railgun(a, ph):
    s = 1.0 + 0.15 * math.sin(ph)
    a['ring'].scale = (s, s, 1.0)

def top_tesla(yaw, m):
    # 特斯拉塔：高柱 + 三环 + 顶部大电球（主识别：棒棒糖高塔轮廓）
    add_cylinder('Column', 0.12, 0.72, 0.86, vertices=20, mat=m['navy_hi'], bevel=0.02, parent=yaw)
    rings = []
    for i in range(3):
        rings.append(add_torus(f'CoilRing{i}', (0, 0, 0.62 + i * 0.22), 0.24, 0.045, m['glow'], yaw))
    orb = add_sphere('Orb', (0, 0, 1.46), (0.27, 0.27, 0.27), m['orb'], yaw)
    for i in range(3):
        a = math.radians(120 * i)
        add_box(f'Strut{i}', (0.05, 0.05, 0.32), (0.32 * math.cos(a), 0.32 * math.sin(a), 0.66),
                m['dark'], 0.01, yaw)
    return {'orb': orb, 'rings': rings}

def anim_tesla(a, ph):
    s = 1.0 + 0.12 * math.sin(ph)
    a['orb'].scale = (s, s, s)
    for i, r in enumerate(a['rings']):
        r.location.z = 0.62 + i * 0.22 + 0.02 * math.sin(ph + i * 2.1)

def top_plasma(yaw, m):
    # 熔核罐：矮胖罐体 + 大半露出罐口的熔浆球（主识别：坩埚里的大火球）
    add_cylinder('Vat', 0.46, 0.34, 0.64, mat=m['navy'], bevel=0.05, parent=yaw)
    hex_ring('VatGlow', 0.47, 0.40, 0.06, 0.82, m['glow'], parent=yaw)
    core = add_sphere('Magma', (0, 0, 1.02), (0.32, 0.32, 0.32), m['glow_hot'], yaw)
    for i in range(4):
        a = math.radians(90 * i + 45)
        add_box(f'Post{i}', (0.07, 0.07, 0.44), (0.40 * math.cos(a), 0.40 * math.sin(a), 0.92),
                m['dark'], 0.01, yaw)
    muzzle = add_cylinder('Muzzle', 0.16, 0.30, 0.72, vertices=20, mat=m['navy_hi'], bevel=0.02, parent=yaw)
    muzzle.rotation_euler.x = math.radians(90)
    muzzle.location.y = -0.5
    return {'core': core}

def anim_plasma(a, ph):
    s = 1.0 + 0.12 * math.sin(ph)
    a['core'].scale = (s, s, s)

TOPS = {
    'laser': (top_laser, anim_laser),
    'missile': (top_missile, anim_missile),
    'frost': (top_frost, anim_frost),
    'railgun': (top_railgun, anim_railgun),
    'tesla': (top_tesla, anim_tesla),
    'plasma': (top_plasma, anim_plasma),
}

# ---------------- 场景 ----------------
def setup_scene():
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

    add_light('Key', (-3.5, -2.5, 6.0), 500, (1.0, 0.95, 0.88), size=4.0)
    add_light('Fill', (4.0, 1.5, 3.0), 280, (0.45, 0.62, 1.0), size=3.0)
    add_light('Rim', (1.0, 4.5, 4.5), 450, (0.35, 0.85, 1.0), size=2.5)

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
    cam_data.ortho_scale = 3.35
    cam = bpy.data.objects.new('CamOrtho', cam_data)
    bpy.context.collection.objects.link(cam)
    elev = math.radians(55)
    cam.location = (0, -8.0 * math.cos(elev), 8.0 * math.sin(elev))
    aim_at(cam, 0, 0, 0.55)
    scene.camera = cam
    return scene

# ---------------- 逐塔构建 + 渲染 ----------------
for ttype, cfg in TOWERS.items():
    if args.only and ttype != args.only:
        continue
    scene = setup_scene()
    yaw = bpy.data.objects.new('Yaw', None)
    bpy.context.collection.objects.link(yaw)

    color = hex_rgba(cfg['color'])
    mats = {
        'navy': mat_metal('BaseNavy', NAVY),
        'navy_hi': mat_metal('BaseNavyHi', NAVY_HI, metallic=0.8, roughness=0.28),
        'dark': mat_metal('DeepSpace', DARK, metallic=0.8, roughness=0.4),
        'steel': mat_metal('Steel', STEEL, metallic=0.95, roughness=0.22),
        'deck': mat_metal('Deck', mix(NAVY_HI, color, 0.5), metallic=0.7, roughness=0.35),
        'glow': mat_glow('Glow', color, strength=2.8),
        'glow_soft': mat_glow('GlowSoft', color, strength=1.6),
        'glow_hot': mat_glow('GlowHot', color, strength=4.2),
        'orb': mat_glow('Orb', color, strength=2.6),
        'warn': mat_glow('Warn', hex_rgba('#FF5A5A'), strength=3.0),
        'warhead': mat_metal('Warhead', hex_rgba('#D8E2F5'), metallic=0.35, roughness=0.35),
        'crystal': mat_crystal('Crystal', color),
    }
    build_base(yaw, mats)
    top_fn, anim_fn = TOPS[ttype]
    anim = top_fn(yaw, mats)

    out_dir = os.path.join(OUT_DIR, ttype)
    walk_dir = os.path.join(out_dir, 'walk')
    os.makedirs(walk_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(MODEL_DIR, f'{ttype}.blend'))

    # f<dir>_<phase>：dir 自屏幕上方顺时针（炮口建模朝 -Y，dir=0 转 180° 朝上）；phase 4 帧待机循环
    for d in range(args.dirs):
        yaw.rotation_euler.z = math.radians(180.0 - (360.0 / args.dirs) * d)
        for p in range(4):
            anim_fn(anim, (p / 4) * math.pi * 2)
            scene.render.filepath = os.path.join(walk_dir, f'f{d:02d}_{p}.png')
            bpy.ops.render.render(write_still=True)
    print(f'[gen-towers-3d] {ttype}: {args.dirs}x4 frames')

    # 特写
    yaw.rotation_euler.z = math.radians(210)
    anim_fn(anim, 0.8)
    hero_data = bpy.data.cameras.new('CamHero')
    hero_data.lens = 55
    hero = bpy.data.objects.new('CamHero', hero_data)
    bpy.context.collection.objects.link(hero)
    hero.location = (3.0, -4.0, 3.0)
    aim_at(hero, 0, 0, 0.7)
    scene.camera = hero
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.filepath = os.path.join(out_dir, 'hero.png')
    bpy.ops.render.render(write_still=True)
    print(f'[gen-towers-3d] {ttype}: hero done')

print('[gen-towers-3d] ALL DONE')
