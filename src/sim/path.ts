import * as THREE from 'three'

/** Height of the belt surface. Cards ride just above it. */
export const BELT_Y = 0.82
export const BELT_WIDTH = 1.05

/**
 * The sorting line: a rounded rectangle that starts at the bottom of the left
 * side (where the scrapers feed in), runs clockwise past the qualifiers,
 * contact finder and verifier, and ends at the loader's outbox. It is left
 * open between the loader and the start so the line reads as start -> end.
 */
const HALF_W = 8
const HALF_D = 6.5
const R = 2.5
const START_Z = HALF_D - R // bottom of the left straight
export const END_X = -1.5 // belt stops here; outbox sits just past it

export class BeltPath {
  readonly pts: THREE.Vector3[] = []
  readonly cum: number[] = []
  readonly length: number

  constructor(points: THREE.Vector3[]) {
    this.pts = points
    let total = 0
    this.cum.push(0)
    for (let i = 1; i < points.length; i++) {
      total += points[i].distanceTo(points[i - 1])
      this.cum.push(total)
    }
    this.length = total
  }

  private index(d: number) {
    let lo = 0
    let hi = this.cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (this.cum[mid] <= d) lo = mid
      else hi = mid
    }
    return lo
  }

  /** Point (and optionally unit tangent) at distance d along the belt. */
  at(d: number, out: THREE.Vector3, tangent?: THREE.Vector3) {
    const dd = THREE.MathUtils.clamp(d, 0, this.length)
    const i = Math.min(this.index(dd), this.pts.length - 2)
    const a = this.pts[i]
    const b = this.pts[i + 1]
    const seg = this.cum[i + 1] - this.cum[i]
    const t = seg > 0 ? (dd - this.cum[i]) / seg : 0
    out.lerpVectors(a, b, t)
    if (tangent) tangent.subVectors(b, a).normalize()
    return out
  }

  /** Distance along the belt closest to floor point (x, z). */
  project(x: number, z: number) {
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < this.pts.length; i++) {
      const p = this.pts[i]
      const dist = (p.x - x) ** 2 + (p.z - z) ** 2
      if (dist < bestDist) {
        bestDist = dist
        best = this.cum[i]
      }
    }
    return best
  }
}

/** Card yaw for a belt tangent so the card's long edge follows the belt. */
export const yawFromTangent = (t: THREE.Vector3) => Math.atan2(-t.z, t.x)

export function buildBeltPath() {
  const pts: THREE.Vector3[] = []
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(2, Math.ceil(len / 0.25))
    for (let i = pts.length ? 1 : 0; i <= n; i++) {
      const t = i / n
      pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, BELT_Y, z0 + (z1 - z0) * t))
    }
  }
  const arc = (cx: number, cz: number, a0: number, a1: number) => {
    const n = 18
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      pts.push(new THREE.Vector3(cx + Math.cos(a) * R, BELT_Y, cz + Math.sin(a) * R))
    }
  }
  const W = HALF_W
  const D = HALF_D
  // left side, heading away from the camera
  line(-W, START_Z, -W, -(D - R))
  arc(-(W - R), -(D - R), Math.PI, Math.PI * 1.5)
  // top (qualifiers)
  line(-(W - R), -D, W - R, -D)
  arc(W - R, -(D - R), Math.PI * 1.5, Math.PI * 2)
  // right side (contact finder, verifier)
  line(W, -(D - R), W, D - R)
  arc(W - R, D - R, 0, Math.PI / 2)
  // bottom, ending at the loader
  line(W - R, D, END_X, D)
  return new BeltPath(pts)
}

export const beltPath = buildBeltPath()
