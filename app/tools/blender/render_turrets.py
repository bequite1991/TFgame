"""
星环防线 — 炮台精灵帧渲染管线 (Blender 4.5 headless)

用法:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python render_turrets.py

一个脚本生成全部资产 (幂等覆盖):
  6 塔 x 3 级 x (1 base + 1 idle + 6 fire) = 144 张 256x256 RGBA PNG
  输出到 app/public/sprites/towers/ 并生成 manifest.json

约定:
  - 纯俯视正交相机, 图像上方 = 世界 +Y (游戏 -Y), 炮管一律朝 +Y 建模
  - 深色金属 + 主题色自发光, 发光感由 compositor Glare (Fog Glow) 提供
"""

import bpy
import json
import math
import os
from mathutils import Vector
from math import radians, pi, sin, cos

# ---------------------------------------------------------------- 路径

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(TOOLS_DIR, "..", "..", "public", "sprites", "towers"))
os.makedirs(OUT_DIR, exist_ok=True)

# ---------------------------------------------------------------- 调色板

DARK1   = "#141C33"   # 底座主色
DARK2   = "#1D2A4A"   # 炮身主色
STEEL   = "#2A3A5F"   # 结构件
GOLD    = "#FFC94D"   # Lv3 点缀
RED     = "#FF3B30"   # 导弹弹头
ICE     = "#9FE8FF"   # 冰晶

TOWER_COLORS = {
    "laser":   "#22E0FF",
    "missile": "#FF9F43",
    "frost":   "#3DF08C",
    "railgun": "#8B5CF6",
    "tesla":   "#FFE93D",
    "plasma":  "#FF6B3D",
}
TOWER_ORDER = ["laser", "missile", "frost", "railgun", "tesla", "plasma"]

FIRE_FRAMES = 6
FLASH_CURVE  = [1.0, 0.70, 0.35, 0.12, 0.03, 0.0]   # 炮口闪光强度
RECOIL_CURVE = [0.0, 1.00, 0.60, 0.30, 0.10, 0.0]   # 后坐行程比例

# 各塔身整体缩放 (炮管前伸, 缩放以上膛闪光不超出半幅 2.5 为上限)
BODY_SCALE = {"laser": 1.0, "missile": 1.45, "frost": 1.05,
              "railgun": 1.05, "tesla": 1.4, "plasma": 1.1}

# ---------------------------------------------------------------- 工具函数

def srgb(hexstr, linear=True):
    c = [int(hexstr[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    if linear:
        c = [v ** 2.2 for v in c]
    return tuple(c) + (1.0,)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def set_sock(node, names, value):
    for n in names:
        s = node.inputs.get(n)
        if s is not None:
            s.default_value = value
            return


def mat_metal(name, hexstr, metallic=0.75, roughness=0.42, emit=None, emit_str=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    set_sock(b, ["Base Color"], srgb(hexstr))
    set_sock(b, ["Metallic"], metallic)
    set_sock(b, ["Roughness"], roughness)
    if emit is not None and emit_str > 0:
        set_sock(b, ["Emission Color", "Emission"], srgb(emit, linear=False))
        set_sock(b, ["Emission Strength"], emit_str)
    return m


def mat_emit(name, hexstr, strength=6.0, base=None):
    """自发光材质; base 给底色, 默认纯黑(只由自发光贡献颜色, 避免灯光洗白)"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    set_sock(b, ["Base Color"], srgb(base, linear=True) if base else (0.0, 0.0, 0.0, 1.0))
    set_sock(b, ["Roughness"], 0.4)
    set_sock(b, ["Emission Color", "Emission"], srgb(hexstr, linear=False))
    set_sock(b, ["Emission Strength"], strength)
    return m


def emit_strength(mat):
    b = mat.node_tree.nodes.get("Principled BSDF")
    for n in ("Emission Strength",):
        s = b.inputs.get(n)
        if s is not None:
            return s
    return None


def apply_mat(obj, mat):
    obj.data.materials.append(mat)


def bevel(obj, width=0.06, segments=2):
    mod = obj.modifiers.new("bev", 'BEVEL')
    mod.width = width
    mod.segments = segments
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier="bev")
    obj.select_set(False)


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def add_cyl(r, d, loc, mat, vertices=32, rot=None, bevel_w=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=d,
                                        location=loc, rotation=rot or (0, 0, 0))
    o = bpy.context.object
    apply_mat(o, mat)
    if vertices <= 8:
        pass
    else:
        smooth(o)
    if bevel_w:
        bevel(o, bevel_w)
    return o


def add_box(scale, loc, mat, rot=None, bevel_w=0.05):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot or (0, 0, 0))
    o = bpy.context.object
    o.scale = (scale[0], scale[1], scale[2])
    bpy.ops.object.transform_apply(scale=True)
    apply_mat(o, mat)
    if bevel_w:
        bevel(o, bevel_w)
    return o


def add_sphere(r, loc, mat, subdiv=2, scale=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    o = bpy.context.object
    if scale:
        o.scale = scale
        bpy.ops.object.transform_apply(scale=True)
    apply_mat(o, mat)
    if subdiv >= 2:
        smooth(o)
    return o


def add_torus(major, minor, loc, mat, rot=None, major_seg=32, minor_seg=10):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=major_seg, minor_segments=minor_seg,
                                     location=loc, rotation=rot or (0, 0, 0))
    o = bpy.context.object
    apply_mat(o, mat)
    smooth(o)
    return o


def add_cone(r1, r2, d, loc, mat, rot=None, vertices=24):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=d,
                                    location=loc, rotation=rot or (0, 0, 0))
    o = bpy.context.object
    apply_mat(o, mat)
    smooth(o)
    return o


def add_empty(loc=(0, 0, 0)):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=loc)
    return bpy.context.object


def parent(objs, par):
    for o in objs:
        o.parent = par


# ---------------------------------------------------------------- 场景/渲染设置

def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    # Standard 视图变换: 霓虹自发光保持饱和 (AgX 会把高亮洗白)
    scene.view_settings.view_transform = 'Standard'

    # 世界: 深色蓝, 提供环境反射让金属不死黑
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.012, 0.02, 0.06, 1.0)
    bg.inputs[1].default_value = 0.6

    # 相机: 正上方正交俯视
    bpy.ops.object.camera_add(location=(0, 0, 12))
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 5.0
    scene.camera = cam

    # 主光: 斜射阳光, 制造体积感与阴影
    bpy.ops.object.light_add(type='SUN', location=(3, 2, 8))
    sun = bpy.context.object
    sun.rotation_euler = (radians(28), radians(18), radians(12))
    sun.data.energy = 2.5
    sun.data.color = (0.85, 0.9, 1.0)

    # 补光: 顶部大面积柔光
    bpy.ops.object.light_add(type='AREA', location=(-2, -1, 9))
    fill = bpy.context.object
    fill.data.energy = 400
    fill.data.shape = 'DISK'
    fill.data.size = 6.0
    fill.data.color = (0.6, 0.75, 1.0)

    # 合成器: Glare (Fog Glow) 提供霓虹发光
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    glare = nt.nodes.new("CompositorNodeGlare")
    glare.glare_type = 'FOG_GLOW'
    glare.quality = 'HIGH'
    glare.threshold = 1.0
    glare.size = 6
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
    nt.links.new(glare.outputs["Image"], comp.inputs["Image"])
    return scene


def render(scene, filename):
    scene.render.filepath = os.path.join(OUT_DIR, filename)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", filename)


# ---------------------------------------------------------------- 底座 (静止层)

def build_base(ttype, level):
    color = TOWER_COLORS[ttype]
    m_dark  = mat_metal("base_dark", DARK1, metallic=0.7, roughness=0.5)
    m_dark2 = mat_metal("base_mid", DARK2, metallic=0.7, roughness=0.45)
    m_steel = mat_metal("base_steel", STEEL, metallic=0.85, roughness=0.3)
    m_ring  = mat_emit("base_ring", color, strength=1.0)
    m_gold  = mat_metal("base_gold", GOLD, metallic=1.0, roughness=0.28,
                        emit=GOLD, emit_str=0.5)

    # 六边形平台 (顶点朝 ±X)
    add_cyl(2.0, 0.5, (0, 0, 0.0), m_dark, vertices=6, bevel_w=0.08)
    # 顶部嵌入层
    add_cyl(1.78, 0.54, (0, 0, 0.02), m_dark2, vertices=6, bevel_w=0.05)
    # 主题色发光六边形刻线
    add_torus(1.52, 0.045, (0, 0, 0.30), m_ring, major_seg=6, minor_seg=8)
    # 中央安装座
    add_cyl(0.85, 0.62, (0, 0, 0.06), m_steel, vertices=6, bevel_w=0.05)
    # 六角螺栓
    for i in range(6):
        a = radians(30) + i * pi / 3
        add_cyl(0.09, 0.62, (1.82 * cos(a), 1.82 * sin(a), 0.04), m_steel, vertices=12)

    if level >= 2:
        # 装甲板 x3
        for i in range(3):
            a = i * 2 * pi / 3 + pi / 6
            add_box((0.62, 0.30, 0.10),
                    (1.15 * cos(a), 1.15 * sin(a), 0.33),
                    m_steel, rot=(0, 0, a), bevel_w=0.04)
        # 发光短线 x3 (间隔布置)
        for i in range(3):
            a = i * 2 * pi / 3 + pi / 2
            add_box((0.34, 0.07, 0.04),
                    (1.28 * cos(a), 1.28 * sin(a), 0.32),
                    m_ring, rot=(0, 0, a), bevel_w=0.0)

    if level >= 3:
        # 金色点缀环 + 金铆钉
        add_torus(1.10, 0.05, (0, 0, 0.32), m_gold, major_seg=6, minor_seg=8)
        for i in range(6):
            a = radians(30) + i * pi / 3
            add_sphere(0.07, (1.30 * cos(a), 1.30 * sin(a), 0.33), m_gold)
        # 更亮的外环
        emit_strength(m_ring).default_value = 1.2


# ---------------------------------------------------------------- 炮身公共件

class Body:
    """炮身构建上下文: 记录后坐组 / 闪光 / 随开火增亮的自发光材质"""
    def __init__(self, color):
        self.color = color
        self.recoil = add_empty()          # 后坐组父节点
        self.flash_objs = []               # 炮口闪光网格
        self.flash_mats = []               # 闪光材质 (strength 随帧变化)
        self.boost = []                    # (mat, base_strength, boost) 开火时增亮

    def flash(self, obj, strength=30.0):
        self.flash_objs.append(obj)
        for m in obj.data.materials:
            self.flash_mats.append((m, strength))

    def set_frame(self, f, recoil_max=0.18):
        t_flash = FLASH_CURVE[f]
        t_rec = RECOIL_CURVE[f]
        self.recoil.location = (0, -recoil_max * t_rec, 0)
        for o in self.flash_objs:
            o.hide_render = (t_flash <= 0.001)
            s = 0.5 + 0.9 * t_flash
            o.scale = (s, s, s)
        for m, peak in self.flash_mats:
            emit_strength(m).default_value = peak * t_flash
        for m, base, boost in self.boost:
            emit_strength(m).default_value = base * (1.0 + boost * t_flash)

    def set_idle(self):
        self.recoil.location = (0, 0, 0)
        for o in self.flash_objs:
            o.hide_render = True
        for m, peak in self.flash_mats:
            emit_strength(m).default_value = 0.0
        for m, base, boost in self.boost:
            emit_strength(m).default_value = base


def std_mats(color):
    return {
        "dark":  mat_metal("b_dark", DARK2, metallic=0.75, roughness=0.45),
        "steel": mat_metal("b_steel", STEEL, metallic=0.85, roughness=0.32),
        "glow":  mat_emit("b_glow", color, strength=1.6),
        "gold":  mat_metal("b_gold", GOLD, metallic=1.0, roughness=0.28,
                           emit=GOLD, emit_str=0.5),
    }


# ---------------------------------------------------------------- 六种炮身
# 全部朝 +Y (图像上方), 半径控制在 ~2.0 以内

def build_laser(level, color):
    b = Body(color)
    m = std_mats(color)
    m_crystal = mat_emit("crystal", color, strength=1.25)
    b.boost.append((m_crystal, 1.25, 3.5))

    # 旋转座
    add_cyl(0.80, 0.45, (0, 0, 0.42), m["dark"], vertices=24, bevel_w=0.05)
    add_torus(0.80, 0.07, (0, 0, 0.60), m["glow"])
    # 中央聚焦水晶 (八面体)
    cry = add_sphere(0.45, (0, 0, 1.05), m_crystal, subdiv=1, scale=(1, 1, 1.5))
    # 双纤细导轨 (后坐组)
    rails = []
    for x in (-0.22, 0.22):
        rails.append(add_box((0.11, 1.55, 0.11), (x, 1.15, 0.62), m["steel"], bevel_w=0.03))
        rails.append(add_box((0.045, 1.45, 0.05), (x, 1.15, 0.71), m["glow"], bevel_w=0.0))
    rails.append(add_cone(0.16, 0.05, 0.4, (0, 1.95, 0.62), m["glow"], rot=(-pi / 2, 0, 0)))
    parent(rails, b.recoil)

    if level >= 2:
        for x in (-0.58, 0.58):
            add_box((0.16, 0.7, 0.3), (x, 0.25, 0.5), m["steel"], bevel_w=0.04)
            add_box((0.05, 0.5, 0.06), (x, 0.25, 0.68), m["glow"], bevel_w=0.0)
    if level >= 3:
        add_torus(0.58, 0.05, (0, 0, 0.72), m["gold"])
        cry.scale = (1.2, 1.2, 1.2)
        emit_strength(m_crystal).default_value = 1.4
        b.boost[-1] = (m_crystal, 1.4, 3.5)

    fl = add_sphere(0.20, (0, 2.1, 0.62), mat_emit("flash", "#BFF4FF", strength=20.0))
    fl.parent = b.recoil
    b.flash(fl, 20.0)
    return b


def build_missile(level, color):
    b = Body(color)
    m = std_mats(color)
    m_red = mat_emit("warhead", RED, strength=1.1)
    m_pod = mat_metal("pod", "#3A4F7F", metallic=0.8, roughness=0.35)

    pods = []
    n_pods = 2 if level == 1 else 4
    xs = (-0.45, 0.45) if n_pods == 2 else (-0.78, -0.27, 0.27, 0.78)
    # 发射架
    frame = [add_box((1.9, 2.1, 0.35), (0, 0.1, 0.35), m["dark"], bevel_w=0.08),
             add_box((1.7, 0.25, 0.5), (0, -0.95, 0.45), m["steel"], bevel_w=0.05)]
    for x in xs:
        pods.append(add_cyl(0.27, 1.8, (x, 0.15, 0.62), m_pod,
                            vertices=20, rot=(pi / 2, 0, 0), bevel_w=0.03))
        # 红色弹头 (前端圆盖)
        pods.append(add_sphere(0.23, (x, 1.08, 0.62), m_red, subdiv=2, scale=(1, 0.6, 1)))
    parent(frame + pods, b.recoil)

    # 前缘橙色发光条
    add_box((1.8, 0.10, 0.12), (0, 1.12, 0.45), m["glow"], bevel_w=0.0)
    # 侧面发光条
    for x in (-0.98, 0.98):
        add_box((0.09, 1.5, 0.10), (x, 0.1, 0.55), m["glow"], bevel_w=0.0)

    if level >= 2:
        for x in (-1.0, 1.0):
            add_box((0.14, 1.1, 0.42), (x, 0.1, 0.4), m["steel"], bevel_w=0.04)
    if level >= 3:
        for x in xs:
            add_torus(0.29, 0.04, (x, 0.55, 0.62), m["gold"], rot=(pi / 2, 0, 0))
        for x in (-0.95, 0.95):
            for y in (-0.8, 1.0):
                add_sphere(0.08, (x, y, 0.55), m["gold"])

    flash_mat = mat_emit("flash", "#FFD9A0", strength=22.0)
    for x in xs[:2]:
        fl = add_sphere(0.22, (x, 1.28, 0.62), flash_mat)
        fl.parent = b.recoil
        b.flash(fl, 22.0)
    return b


def build_frost(level, color):
    b = Body(color)
    m = std_mats(color)
    m_ice = mat_metal("ice", "#6E93C2", metallic=0.1, roughness=0.25, emit=color, emit_str=1.6)
    m_orb = mat_emit("orb", color, strength=1.15)
    b.boost.append((m_orb, 1.15, 3.5))

    add_cyl(0.9, 0.4, (0, 0, 0.35), m["dark"], vertices=24, bevel_w=0.05)
    add_torus(0.9, 0.06, (0, 0, 0.52), m["glow"])

    # 冰晶簇 (环绕中心, 向外倾斜)
    n = 6
    for i in range(n):
        a = i * 2 * pi / n + pi / 6
        tilt = radians(28)
        c = add_cone(0.26, 0.02, 1.0, (0.72 * cos(a), 0.72 * sin(a), 0.75), m_ice)
        c.rotation_euler = (tilt * sin(a), -tilt * cos(a), 0)
    # 前向主冰刺 (指向 +Y, 标识朝向; 随开火前伸)
    spike = [add_cone(0.22, 0.02, 1.3, (0, 1.35, 0.62), m_ice, rot=(-pi / 2, 0, 0))]
    parent(spike, b.recoil)
    # 悬浮冰球
    orb = add_sphere(0.42, (0, -0.1, 1.35), m_orb, subdiv=2)

    if level >= 2:
        for i in range(6):
            a = i * 2 * pi / 6
            c = add_cone(0.14, 0.02, 0.55, (0.45 * cos(a), 0.45 * sin(a), 0.62), m_ice)
            c.rotation_euler = (radians(15) * sin(a), -radians(15) * cos(a), 0)
    if level >= 3:
        add_torus(0.66, 0.045, (0, 0, 0.60), m["gold"])
        orb.scale = (1.2, 1.2, 1.2)
        for i in range(3):
            a = i * 2 * pi / 3 + pi / 2
            shard = add_cone(0.10, 0.02, 0.45,
                             (0.62 * cos(a), 0.62 * sin(a) - 0.1, 1.35), m_ice,
                             rot=(0, radians(70), a))
        b.boost[-1] = (m_orb, 1.3, 3.5)
        emit_strength(m_orb).default_value = 1.3

    fl = add_sphere(0.26, (0, 1.9, 0.62), mat_emit("flash", "#C8FFDD", strength=20.0))
    fl.parent = b.recoil
    b.flash(fl, 20.0)
    return b


def build_railgun(level, color):
    b = Body(color)
    m = std_mats(color)
    n_coils = 3 if level == 1 else (4 if level == 2 else 5)
    m_coil = mat_emit("coil", color, strength=1.25)
    m_cell = mat_emit("cell", color, strength=1.2)
    b.boost.append((m_coil, 1.25, 3.5))

    # 后部电源舱
    add_cyl(0.85, 0.5, (0, -0.9, 0.45), m["dark"], vertices=24, bevel_w=0.06)
    add_sphere(0.35, (0, -0.9, 0.75), m_cell, subdiv=2, scale=(1, 1, 0.6))

    grp = []
    # 双平行轨道
    for x in (-0.34, 0.34):
        grp.append(add_box((0.16, 2.5, 0.20), (x, 0.55, 0.55), m["steel"], bevel_w=0.04))
        grp.append(add_box((0.06, 2.4, 0.07), (x, 0.55, 0.68), m["glow"], bevel_w=0.0))
    # 线圈环 (俯视下为横跨双轨的方环)
    for i in range(n_coils):
        y = -0.25 + i * (1.75 / max(n_coils - 1, 1))
        grp.append(add_box((1.05, 0.16, 0.46), (0, y, 0.55), m_coil, bevel_w=0.05))
    if level >= 3:
        for y in (-0.45, 1.5):
            grp.append(add_box((1.15, 0.12, 0.52), (0, y, 0.55), m["gold"], bevel_w=0.04))
    parent(grp, b.recoil)

    if level >= 2:
        for x in (-0.62, 0.62):
            add_box((0.14, 1.6, 0.4), (x, 0.3, 0.45), m["steel"], bevel_w=0.04)

    fl = add_sphere(0.24, (0, 1.95, 0.60), mat_emit("flash", "#DCCBFF", strength=22.0))
    fl.parent = b.recoil
    b.flash(fl, 22.0)
    return b


def build_tesla(level, color):
    b = Body(color)
    m = std_mats(color)
    m_ring = mat_emit("tring", color, strength=1.5)
    m_ball = mat_metal("ball", "#C9D4E8", metallic=1.0, roughness=0.2,
                       emit=color, emit_str=0.8)
    b.boost.append((m_ring, 1.5, 2.5))
    b.boost.append((m_ball, 0.8, 3.5))

    add_cyl(0.95, 0.45, (0, 0, 0.35), m["dark"], vertices=24, bevel_w=0.05)
    # 中央线圈柱: 交替金属盘与发光环
    z = 0.55
    for i in range(5):
        r = 0.62 - i * 0.07
        add_torus(r, 0.085, (0, 0, z), m_ring)
        z += 0.26
    add_cyl(0.30, 1.35, (0, 0, 1.05), m["steel"], vertices=16)
    # 顶部金属球
    add_sphere(0.52, (0, 0, 2.0), m_ball, subdiv=2)
    # 前向放电叉 (标识朝向)
    prong = [add_cone(0.10, 0.02, 0.7, (-0.2, 1.05, 0.5), m["steel"], rot=(-pi / 2, 0, 0)),
             add_cone(0.10, 0.02, 0.7, (0.2, 1.05, 0.5), m["steel"], rot=(-pi / 2, 0, 0)),
             add_box((0.55, 0.18, 0.14), (0, 0.72, 0.5), m["glow"], bevel_w=0.03)]
    parent(prong, b.recoil)

    if level >= 2:
        for i in range(4):
            a = i * pi / 2 + pi / 4
            add_box((0.16, 0.5, 0.35), (0.95 * cos(a), 0.95 * sin(a), 0.45),
                    m["steel"], rot=(0, 0, a), bevel_w=0.04)
    if level >= 3:
        add_torus(0.80, 0.05, (0, 0, 0.55), m["gold"])
        for i in range(3):
            a = i * 2 * pi / 3 + pi / 2
            add_torus(0.22, 0.06, (1.15 * cos(a), 1.15 * sin(a), 0.55), m_ring)
            add_cyl(0.10, 0.5, (1.15 * cos(a), 1.15 * sin(a), 0.45), m["steel"], vertices=12)

    flash_mat = mat_emit("flash", "#FFF6C0", strength=18.0)
    # 球周电弧小球
    for i in range(4):
        a = i * pi / 2 + pi / 4
        fl = add_sphere(0.16, (0.62 * cos(a), 0.62 * sin(a), 2.0), flash_mat)
        b.flash(fl, 18.0)
    return b


def build_plasma(level, color):
    b = Body(color)
    m = std_mats(color)
    m_core = mat_emit("core", color, strength=1.2)
    b.boost.append((m_core, 1.2, 3.5))

    # 熔核罐体
    add_cyl(1.0, 0.75, (0, -0.25, 0.5), m["dark"], vertices=24, bevel_w=0.08)
    add_torus(1.0, 0.06, (0, -0.25, 0.82), m["glow"])
    # 顶部发光核心
    add_cyl(0.55, 0.80, (0, -0.25, 0.55), m_core, vertices=24)
    add_torus(0.55, 0.07, (0, -0.25, 0.95), m["steel"])

    # 短粗炮管 (后坐组)
    grp = [add_cyl(0.46, 1.15, (0, 1.0, 0.62), m["steel"], vertices=20,
                   rot=(pi / 2, 0, 0), bevel_w=0.05),
           add_torus(0.46, 0.07, (0, 1.42, 0.62), m_core, rot=(pi / 2, 0, 0)),
           add_torus(0.46, 0.06, (0, 0.72, 0.62), m["glow"], rot=(pi / 2, 0, 0))]
    parent(grp, b.recoil)

    if level >= 2:
        for x in (-0.95, 0.95):
            add_box((0.22, 0.9, 0.45), (x, -0.1, 0.45), m["steel"], bevel_w=0.05)
            add_box((0.08, 0.6, 0.08), (x, -0.1, 0.72), m["glow"], bevel_w=0.0)
    if level >= 3:
        add_torus(1.02, 0.05, (0, -0.25, 0.30), m["gold"])
        add_torus(0.47, 0.05, (0, 1.05, 0.62), m["gold"], rot=(pi / 2, 0, 0)).parent = b.recoil
        emit_strength(m_core).default_value = 1.35
        b.boost[-1] = (m_core, 1.35, 3.5)

    fl = add_sphere(0.34, (0, 1.75, 0.62), mat_emit("flash", "#FFC9A8", strength=22.0))
    fl.parent = b.recoil
    b.flash(fl, 22.0)
    return b


BUILDERS = {
    "laser": build_laser,
    "missile": build_missile,
    "frost": build_frost,
    "railgun": build_railgun,
    "tesla": build_tesla,
    "plasma": build_plasma,
}


# ---------------------------------------------------------------- 主流程

def main():
    scene = setup_scene()
    manifest = {"frame_size": 256, "fire_frames": FIRE_FRAMES, "towers": {}}

    for ttype in TOWER_ORDER:
        manifest["towers"][ttype] = {}
        for level in (1, 2, 3):
            clear_scene()
            setup_scene()

            # ---- base ----
            keep = set(bpy.data.objects)   # 相机/灯光等场景设施
            build_base(ttype, level)
            base_name = "%s_lv%d_base.png" % (ttype, level)
            render(scene, base_name)
            for o in [o for o in bpy.data.objects if o not in keep]:
                bpy.data.objects.remove(o, do_unlink=True)

            # ---- body ----
            keep2 = set(bpy.data.objects)
            body = BUILDERS[ttype](level, TOWER_COLORS[ttype])
            root = add_empty()
            for o in [o for o in bpy.data.objects if o not in keep2]:
                if o.parent is None and o != root:
                    o.parent = root
            s = BODY_SCALE[ttype]
            root.scale = (s, s, s)
            idle_name = "%s_lv%d_body_idle.png" % (ttype, level)
            body.set_idle()
            render(scene, idle_name)

            fire_names = []
            for f in range(FIRE_FRAMES):
                body.set_frame(f)
                fn = "%s_lv%d_body_fire_%d.png" % (ttype, level, f)
                render(scene, fn)
                fire_names.append(fn)

            manifest["towers"][ttype][str(level)] = {
                "base": base_name,
                "idle": idle_name,
                "fire": fire_names,
                "fire_frames": FIRE_FRAMES,
            }
            print("DONE", ttype, "lv", level)

    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as fp:
        json.dump(manifest, fp, indent=2, ensure_ascii=False)
    print("ALL_DONE ->", OUT_DIR)


main()
