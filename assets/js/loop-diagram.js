// Isometric "circuit" diagram: nodes on a flat grid, joined by traces that pulse in a loop.
// Everything is laid out in plain 2D units (x to the right, y downward); a single SVG
// transform tilts the whole plane into an isometric view, so editing the config is just
// editing x/y numbers.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const COS30 = Math.cos(Math.PI / 6);
  const SIN30 = 0.5;

  const DEFAULTS = {
    corner: 14,          // size of the 45° chamfer where a trace turns
    pulseLength: 46,     // length of the travelling glow, in plane units
    travelMs: 1100,      // time for a pulse to run hub -> node
    holdMs: 700,         // time the target node stays lit
    gapMs: 250,          // pause before the next pulse
  };

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function project(x, y) {
    return [COS30 * (x - y), SIN30 * (x + y)];
  }

  // Replace each interior corner with two points so turns are chamfered, like circuit traces.
  function chamfer(points, size) {
    if (!size || points.length < 3) return points;
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const [px, py] = points[i - 1];
      const [cx, cy] = points[i];
      const [nx, ny] = points[i + 1];
      const inLen = Math.hypot(cx - px, cy - py);
      const outLen = Math.hypot(nx - cx, ny - cy);
      const c = Math.min(size, inLen / 2, outLen / 2);
      out.push([cx - ((cx - px) / inLen) * c, cy - ((cy - py) / inLen) * c]);
      out.push([cx + ((nx - cx) / outLen) * c, cy + ((ny - cy) / outLen) * c]);
    }
    out.push(points[points.length - 1]);
    return out;
  }

  // Default route leaves the hub's right edge, runs along x, then turns along y into the node.
  // Exits are ordered so traces to farther nodes sit on top and do not cross the others.
  function buildRoutes(hub, links, byId) {
    const order = links
      .map((link, i) => ({ link, i, target: byId[link.to] }))
      .sort((a, b) => b.target.x - a.target.x);
    const routes = new Array(links.length);
    order.forEach(({ link, i, target }, slot) => {
      if (link.via) {
        routes[i] = [[hub.x, hub.y], ...link.via, [target.x, target.y]];
        return;
      }
      const exitY = hub.y - hub.h / 2 + ((slot + 1) * hub.h) / (order.length + 1);
      routes[i] = [
        [hub.x + hub.w / 2, exitY],
        [target.x, exitY],
        [target.x, target.y],
      ];
    });
    return routes;
  }

  function networkGlyph(parent, x, y, r) {
    const s = r * 0.42;
    const pts = [[x, y - s], [x - s, y + s * 0.7], [x + s, y + s * 0.7]];
    const g = el("g", { class: "ld-glyph" }, parent);
    el("polygon", { points: pts.map((p) => p.join(",")).join(" ") }, g);
    pts.forEach(([px, py]) => el("circle", { cx: px, cy: py, r: r * 0.1 }, g));
    el("circle", { cx: x, cy: y, r: r * 0.1 }, g);
  }

  function create(container, config) {
    const svg = el("svg", { class: "loop-diagram", role: "img" });
    container.replaceChildren(svg);
    let frame = 0;
    let state = null;

    function render(cfg) {
      cancelAnimationFrame(frame);
      const opts = { ...DEFAULTS, ...cfg };
      const hub = { w: 150, h: 70, ...cfg.hub };
      const nodes = cfg.nodes.map((n) => ({ r: 26, ...n }));
      const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
      const links = (cfg.links || nodes.map((n) => ({ to: n.id }))).filter((l) => byId[l.to]);
      const routes = buildRoutes(hub, links, byId).map((pts) => chamfer(pts, opts.corner));

      svg.replaceChildren();
      svg.setAttribute("aria-label", cfg.title || "Diagram of " + hub.label);

      // Fit the viewBox to everything once projected.
      const extents = [];
      routes.forEach((pts) => extents.push(...pts));
      nodes.forEach((n) => extents.push([n.x - n.r, n.y - n.r], [n.x + n.r, n.y + n.r + 30]));
      extents.push([hub.x - hub.w / 2, hub.y - hub.h / 2], [hub.x + hub.w / 2, hub.y + hub.h / 2]);
      const projected = extents.map(([x, y]) => project(x, y));
      const xs = projected.map((p) => p[0]);
      const ys = projected.map((p) => p[1]);
      const pad = 40;
      const minX = Math.min(...xs) - pad;
      const minY = Math.min(...ys) - pad;
      svg.setAttribute("viewBox", `${minX} ${minY} ${Math.max(...xs) - minX + pad} ${Math.max(...ys) - minY + pad}`);

      const defs = el("defs", {}, svg);
      // userSpaceOnUse: a straight trace has a zero-height bounding box, which would clip the glow.
      const glow = el("filter", { id: "ld-glow", filterUnits: "userSpaceOnUse", x: -5000, y: -5000, width: 10000, height: 10000 }, defs);
      el("feGaussianBlur", { stdDeviation: 4, result: "blur" }, glow);
      const merge = el("feMerge", {}, glow);
      el("feMergeNode", { in: "blur" }, merge);
      el("feMergeNode", { in: "SourceGraphic" }, merge);

      const plane = el("g", { transform: `matrix(${COS30} ${SIN30} ${-COS30} ${SIN30} 0 0)` }, svg);
      const traceLayer = el("g", { class: "ld-traces" }, plane);
      const pulseLayer = el("g", { class: "ld-pulses", filter: "url(#ld-glow)" }, plane);
      const nodeLayer = el("g", { class: "ld-nodes" }, plane);

      const traces = routes.map((pts) => {
        const d = "M" + pts.map((p) => p.join(",")).join("L");
        const base = el("path", { d, class: "ld-trace" }, traceLayer);
        const pulse = el("path", { d, class: "ld-pulse" }, pulseLayer);
        const length = base.getTotalLength();
        // Draw-in on load: start fully dashed out, then transition to drawn.
        base.style.strokeDasharray = length;
        base.style.strokeDashoffset = length;
        pulse.style.strokeDasharray = `${opts.pulseLength} ${length + opts.pulseLength}`;
        pulse.style.strokeDashoffset = opts.pulseLength;
        return { base, pulse, length };
      });

      const hubGroup = el("g", { class: "ld-hub" }, nodeLayer);
      el("rect", { x: hub.x - hub.w / 2, y: hub.y - hub.h / 2, width: hub.w, height: hub.h, rx: 6 }, hubGroup);
      if (hub.sublabel) {
        el("text", { x: hub.x - hub.w / 2 + 12, y: hub.y - 10, class: "ld-hub-sub" }, hubGroup).textContent = hub.sublabel;
      }
      el("text", { x: hub.x - hub.w / 2 + 12, y: hub.y + 14, class: "ld-hub-label" }, hubGroup).textContent = hub.label;

      const nodeEls = links.map((link) => {
        const n = byId[link.to];
        const g = el("g", { class: "ld-node" }, nodeLayer);
        el("circle", { cx: n.x, cy: n.y, r: n.r, class: "ld-ring" }, g);
        networkGlyph(g, n.x, n.y, n.r);
        el("text", { x: n.x, y: n.y + n.r + 18, class: "ld-label" }, g).textContent = n.label;
        return g;
      });

      requestAnimationFrame(() => traces.forEach((t) => (t.base.style.strokeDashoffset = 0)));

      if (matchMedia("(prefers-reduced-motion: reduce)").matches || !traces.length) return;

      const step = opts.travelMs + opts.holdMs + opts.gapMs;
      const cycle = step * traces.length;
      const start = performance.now() + 1200; // let the draw-in finish first
      state = { traces, nodeEls, opts, step, cycle, start };
      frame = requestAnimationFrame(tick);
    }

    function tick(now) {
      const { traces, nodeEls, opts, step, cycle, start } = state;
      const t = Math.max(0, now - start) % cycle;
      const active = Math.floor(t / step);
      const local = t - active * step;
      traces.forEach((trace, i) => {
        const progress = i === active ? Math.min(1, local / opts.travelMs) : 0;
        const eased = progress * progress * (3 - 2 * progress);
        trace.pulse.style.strokeDashoffset = opts.pulseLength - eased * (trace.length + opts.pulseLength);
        const lit = i === active && local >= opts.travelMs * 0.9 && local < opts.travelMs + opts.holdMs;
        nodeEls[i].classList.toggle("is-active", lit);
      });
      frame = requestAnimationFrame(tick);
    }

    render(config);
    return {
      update: render,
      destroy() {
        cancelAnimationFrame(frame);
        svg.remove();
      },
    };
  }

  window.LoopDiagram = { create };
})();
