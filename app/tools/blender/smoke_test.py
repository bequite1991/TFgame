"""Minimal headless render smoke test: one glowing cube on a hex base, PNG RGBA."""
import bpy, sys, os

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "smoke_test.png")

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 256
scene.render.resolution_y = 256
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = out

# cube with emission
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
cube = bpy.context.object
mat = bpy.data.materials.new("glow")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.1, 0.8, 1.0, 1.0)
bsdf.inputs["Emission Color"].default_value = (0.1, 0.8, 1.0, 1.0)
bsdf.inputs["Emission Strength"].default_value = 5.0
cube.data.materials.append(mat)

# hex base
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=1.5, depth=0.3, location=(0, 0, -0.15))
hexobj = bpy.context.object
mat2 = bpy.data.materials.new("base")
mat2.use_nodes = True
b2 = mat2.node_tree.nodes["Principled BSDF"]
b2.inputs["Base Color"].default_value = (0.08, 0.11, 0.2, 1.0)
b2.inputs["Metallic"].default_value = 0.9
b2.inputs["Roughness"].default_value = 0.35
hexobj.data.materials.append(mat2)

# key light
bpy.ops.object.light_add(type='SUN', location=(2, 2, 5))
sun = bpy.context.object
sun.data.energy = 3.0

# ortho camera top-down
bpy.ops.object.camera_add(location=(0, 0, 10))
cam = bpy.context.object
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 5.0
scene.camera = cam

# compositor glare
scene.use_nodes = True
nt = scene.node_tree
nt.nodes.clear()
rl = nt.nodes.new("CompositorNodeRLayers")
glare = nt.nodes.new("CompositorNodeGlare")
glare.glare_type = 'FOG_GLOW'
glare.quality = 'HIGH'
glare.threshold = 1.0
glare.size = 7
comp = nt.nodes.new("CompositorNodeComposite")
nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
nt.links.new(glare.outputs["Image"], comp.inputs["Image"])

bpy.ops.render.render(write_still=True)
print("SMOKE_TEST_DONE", out)
