import { START_DIRECTORIES, DISCOVERABLE_DIRECTORIES } from './floor'

export const ARCHIVE_DIRECTORIES = [...START_DIRECTORIES, ...DISCOVERABLE_DIRECTORIES]
export const directoryPosition = (index: number): [number, number, number] => index < 4
  ? [-15.1, 0, 3.75 - index * 2.5]
  : [-11.8 + (index - 4) * 4, 0, -10.7]
export const directoryFacing = (index: number) => index < 4 ? Math.PI / 2 : 0
export const INTAKE_HUB: [number, number, number] = [-12.7, 1, -6.7]

/** Behind the drawers, up to the visible header, then into the intake manifold. */
export function archiveRoute(index: number): [number, number, number][] {
  const [x, , z] = directoryPosition(index)
  if (index < 4) return [[x - .68, 2.5, z], [x - .9, 4.5, z], [x - .9, 4.5, -7.2], [-12.7, 4.5, -7.2], [-12.7, 1.3, -6.7]]
  return [[x, 2.5, z - .7], [x, 4.5, z - .7], [x, 4.5, -8.9], [-12.7, 4.5, -8.9], [-12.7, 1.3, -6.7]]
}
