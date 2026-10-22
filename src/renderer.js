import { getStroke } from 'perfect-freehand';
import { denormalizePoint, distanceToSegment } from './coordinates.js';
const NS = 'http://www.w3.org/2000/svg';
// A fixed model width makes pen widths independent of screen size and orientation.
export const MODEL_WIDTH = 960;
function outline(stroke, complete = true) {
  return getStroke(stroke.points.map(p => denormalizePoint(p, MODEL_WIDTH, MODEL_WIDTH / stroke.aspect)), {
    size: stroke.width, ...stroke.options, last: complete
  });
}
export function pathData(points) {
  if (!points.length) return '';
  // Join outline samples with midpoint quadratic curves instead of polygon corners.
  const midpoint = (a, b) => [(a[0]+b[0])/2, (a[1]+b[1])/2];
  const start = midpoint(points.at(-1), points[0]);
  return `M ${start.join(' ')} ` + points.map((p, i) =>
    `Q ${p.join(' ')} ${midpoint(p, points[(i+1)%points.length]).join(' ')}`).join(' ') + ' Z';
}
export function hitStroke(stroke, from, to, aspect, radius) {
  const points = outline(stroke).map(([x, y]) => [x, y * stroke.aspect / aspect]);
  const a = denormalizePoint(from, MODEL_WIDTH, MODEL_WIDTH / aspect);
  const b = denormalizePoint(to, MODEL_WIDTH, MODEL_WIDTH / aspect);
  // Test the outline against the whole eraser sweep, including crossings between samples.
  const cross = (p, q, r) => (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const p = points[i], q = points[j];
    if ((p[1] > a[1]) !== (q[1] > a[1]) && a[0] < (q[0]-p[0])*(a[1]-p[1])/(q[1]-p[1])+p[0]) inside = !inside;
    if (Math.min(distanceToSegment(p,a,b), distanceToSegment(q,a,b), distanceToSegment(a,p,q), distanceToSegment(b,p,q)) <= radius) return true;
    if (cross(a,b,p)*cross(a,b,q) < 0 && cross(p,q,a)*cross(p,q,b) < 0) return true;
  }
  return inside;
}
export class Renderer {
  constructor() { this.surfaces = new Map(); }
  surface(slide) {
    if (!this.surfaces.has(slide)) {
      const svg = document.createElementNS(NS, 'svg');
      svg.classList.add('reveal-ink-surface'); svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('preserveAspectRatio', 'none');
      slide.append(svg); this.surfaces.set(slide, svg);
    }
    return this.surfaces.get(slide);
  }
  layout(slide, width, height, root, scale, scroll = 0) {
    const svg = this.surface(slide);
    const bounds = root.getBoundingClientRect();
    const fullWidth = bounds.width / scale, fullHeight = bounds.height / scale;
    const padX = (fullWidth-width)/2, padY = (fullHeight-height)/2;
    svg.style.width = `${fullWidth}px`; svg.style.height = `${fullHeight}px`;
    svg.style.left = `${-padX}px`; svg.style.top = `${-slide.offsetTop-padY}px`;
    svg.setAttribute('viewBox', `${-padX*MODEL_WIDTH/width} ${(-padY + scroll*height)*MODEL_WIDTH/width} ${fullWidth*MODEL_WIDTH/width} ${fullHeight*MODEL_WIDTH/width}`);
    // Firefox resolves an absolutely positioned SVG differently inside Reveal's
    // centered slides, including ordinary slides and dynamic flashcards.
    // Correct the rendered surface without changing stored annotation coordinates.
    if (/Firefox\//.test(navigator.userAgent)) {
      const slideBounds = slide.getBoundingClientRect();
      const slideCenter = slideBounds.left + slideBounds.width/2;
      const viewportCenter = bounds.left + bounds.width/2;
      // slidechanged fires before horizontal transitions finish. Anchoring from
      // that transient off-screen rect moves saved ink onto an adjacent slide.
      if (Math.abs(slideCenter-viewportCenter) < 2) {
        const renderedScale = slideBounds.width / slide.offsetWidth;
        svg.style.left = `${(bounds.left-slideBounds.left)/renderedScale}px`;
        svg.style.top = `${(bounds.top-slideBounds.top)/renderedScale}px`;
        const positioned = svg.getBoundingClientRect();
        svg.style.left = `${parseFloat(svg.style.left) + (bounds.left-positioned.left)/renderedScale}px`;
        svg.style.top = `${parseFloat(svg.style.top) + (bounds.top-positioned.top)/renderedScale}px`;
      }
    }
    svg.inkRect = { left: bounds.left + padX*scale, top: bounds.top + padY*scale - scroll*height*scale,
      width: width*scale, height: height*scale };
    return svg;
  }
  path(stroke, complete = true) {
    const node = document.createElementNS(NS, 'path');
    node.dataset.stroke = stroke.id;
    node.setAttribute('d', pathData(outline(stroke, complete)));
    node.setAttribute('fill', stroke.color);
    node.setAttribute('opacity', stroke.tool === 'highlighter' ? '0.3' : '1');
    return node;
  }
  render(slide, strokes, aspect) {
    const svg = this.surface(slide); svg.querySelectorAll(':scope > path').forEach(node => node.remove());
    for (const stroke of strokes) {
      const path = this.path(stroke);
      path.setAttribute('transform', `scale(1 ${stroke.aspect / aspect})`); svg.insertBefore(path, svg.querySelector('.reveal-ink-laser'));
    }
  }
  preview(slide, stroke) {
    const svg = this.surface(slide);
    svg.querySelector('[data-preview]')?.remove();
    if (stroke) { const node = this.path(stroke, false); node.dataset.preview = ''; svg.append(node); }
  }
  laser(slide, stroke, hold, fade) {
    const group = document.createElementNS(NS, 'g');
    group.classList.add('reveal-ink-laser');
    group.append(this.path(stroke)); this.surface(slide).append(group);
    const animation = group.animate([{ opacity: 1 }, { opacity: 0 }],
      { delay: hold, duration: fade, fill: 'forwards' });
    animation.finished.then(() => group.remove()).catch(() => {});
  }
  clearLaser() {
    for (const svg of this.surfaces.values()) {
      for (const node of svg.querySelectorAll('.reveal-ink-laser')) {
        node.getAnimations().forEach(animation => animation.cancel()); node.remove();
      }
    }
  }
  destroy() { this.clearLaser(); for (const svg of this.surfaces.values()) svg.remove(); this.surfaces.clear(); }
}
