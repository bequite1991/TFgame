// 皮肤模块注册表：key 与 main.ts 的 Skin.id 一一对应。
// 渲染/触摸分发统一经 SKIN_MODULES[skin.id] 查找，钩子缺省时走 main.ts 内置兜底。
import type { SkinModule } from './types';
import { abyssSkin } from './abyss';
import { emberSkin } from './ember';
import { matrixSkin } from './matrix';

export const SKIN_MODULES: Record<string, SkinModule> = {
  abyss: abyssSkin,
  ember: emberSkin,
  matrix: matrixSkin,
};
