import L from 'leaflet';

/**
 * Kernel Density Estimation (KDE) Heatmap Layer for Leaflet.
 * Uses a bivariate Gaussian radial kernel to accumulate density fields on an HTML5 canvas,
 * then maps accumulated density values to a smooth, continuous disaster risk color ramp.
 */
export class KdeHeatmapLayer extends L.Layer {
  constructor(latlngs = [], options = {}) {
    super();
    this._latlngs = latlngs; // Array of [lat, lng, weight]
    this._options = {
      radius: options.radius || 36,
      blur: options.blur || 22,
      max: options.max || 1.0,
      minOpacity: options.minOpacity || 0.05,
      gradient: options.gradient || {
        0.15: 'rgba(59, 130, 246, 0.6)',  // Blue (Low density / sparse incident)
        0.35: 'rgba(6, 182, 212, 0.75)', // Cyan (Moderate alert)
        0.55: 'rgba(34, 197, 94, 0.85)', // Lime Green (Elevated risk)
        0.75: 'rgba(245, 158, 11, 0.92)', // Amber / Orange (High density cluster)
        0.95: 'rgba(239, 68, 68, 0.98)',  // Crimson Red (Critical emergency hotspot)
      },
      ...options,
    };
    this._canvas = null;
    this._ctx = null;
    this._circleStamp = null;
    this._palette = null;
    this._animFrame = null;
  }

  setLatLngs(latlngs) {
    this._latlngs = latlngs;
    return this.redraw();
  }

  setOptions(options) {
    this._options = { ...this._options, ...options };
    this._circleStamp = null;
    this._palette = null;
    return this.redraw();
  }

  onAdd(map) {
    this._map = map;

    if (!this._canvas) {
      this._initCanvas();
    }

    const pane = map.getPanes().overlayPane;
    pane.appendChild(this._canvas);

    map.on('moveend zoomend viewreset resize', this._reset, this);

    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on('zoomanim', this._animateZoom, this);
    }

    this._reset();
  }

  onRemove(map) {
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }

    map.off('moveend zoomend viewreset resize', this._reset, this);

    if (map.options.zoomAnimation) {
      map.off('zoomanim', this._animateZoom, this);
    }

    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  redraw() {
    if (this._map && !this._animFrame) {
      this._animFrame = requestAnimationFrame(() => {
        this._redraw();
        this._animFrame = null;
      });
    }
    return this;
  }

  _initCanvas() {
    const canvas = document.createElement('canvas');
    canvas.className = 'leaflet-zoom-animated kde-heatmap-canvas';
    canvas.style.pointerEvents = 'none';
    canvas.style.position = 'absolute';
    canvas.style.transformOrigin = '50% 50%';

    const size = this._map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;

    this._canvas = canvas;
    this._ctx = canvas.getContext('2d', { willReadFrequently: true });
  }

  _reset() {
    if (!this._map || !this._canvas) return;

    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);

    const size = this._map.getSize();
    if (this._canvas.width !== size.x || this._canvas.height !== size.y) {
      this._canvas.width = size.x;
      this._canvas.height = size.y;
    }

    this._redraw();
  }

  _animateZoom(e) {
    if (!this._map || !this._canvas) return;
    const scale = this._map.getZoomScale(e.zoom);
    const offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());

    if (L.DomUtil.setTransform) {
      L.DomUtil.setTransform(this._canvas, offset, scale);
    } else {
      this._canvas.style[L.DomUtil.TRANSFORM] = `${L.DomUtil.getTranslateString(offset)} scale(${scale})`;
    }
  }

  /**
   * Pre-renders the 2D Gaussian radial kernel stamp.
   */
  _getKernelStamp() {
    if (this._circleStamp) return this._circleStamp;

    const r = this._options.radius;
    const blur = this._options.blur;
    const d = (r + blur) * 2;

    const stamp = document.createElement('canvas');
    stamp.width = d;
    stamp.height = d;
    const ctx = stamp.getContext('2d');

    const center = r + blur;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);

    // Continuous Gaussian decay approximation
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(0.2, 'rgba(0, 0, 0, 0.85)');
    gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.25)');
    gradient.addColorStop(0.9, 'rgba(0, 0, 0, 0.06)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, d, d);

    this._circleStamp = stamp;
    return stamp;
  }

  /**
   * Generates a 256-step RGBA lookup palette from the gradient stops.
   */
  _getPalette() {
    if (this._palette) return this._palette;

    const paletteCanvas = document.createElement('canvas');
    paletteCanvas.width = 1;
    paletteCanvas.height = 256;
    const pCtx = paletteCanvas.getContext('2d');

    const grad = pCtx.createLinearGradient(0, 0, 0, 256);
    const stops = this._options.gradient;
    for (const [stop, color] of Object.entries(stops)) {
      grad.addColorStop(parseFloat(stop), color);
    }

    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 1, 256);

    this._palette = pCtx.getImageData(0, 0, 1, 256).data;
    return this._palette;
  }

  _redraw() {
    if (!this._map || !this._ctx || !this._canvas) return;

    const width = this._canvas.width;
    const height = this._canvas.height;
    if (width === 0 || height === 0) return;

    const ctx = this._ctx;
    ctx.clearRect(0, 0, width, height);

    if (!this._latlngs || this._latlngs.length === 0) return;

    const kernel = this._getKernelStamp();
    const kernelRadius = this._options.radius + this._options.blur;
    const bounds = this._map.getBounds();

    // 1. Accumulate density onto alpha channel
    for (let i = 0; i < this._latlngs.length; i++) {
      const item = this._latlngs[i];
      const lat = item[0] ?? item.lat;
      const lng = item[1] ?? item.lng;
      const weight = item[2] ?? item.intensity ?? item.weight ?? 0.7;

      // Check roughly within view
      if (!bounds.pad(0.2).contains([lat, lng])) continue;

      const point = this._map.latLngToContainerPoint([lat, lng]);

      // Draw radial Gaussian kernel scaled by weight
      ctx.globalAlpha = Math.min(Math.max(weight * 0.75, 0.08), 1.0);
      ctx.drawImage(
        kernel,
        point.x - kernelRadius,
        point.y - kernelRadius
      );
    }

    // 2. Colorize using the KDE palette
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;
    const palette = this._getPalette();
    const len = pixels.length;
    const minAlpha = Math.round(this._options.minOpacity * 255);

    for (let i = 3; i < len; i += 4) {
      const alpha = pixels[i];
      if (alpha > minAlpha) {
        // Map accumulated density alpha (0-255) to the 256-step thermal color palette
        const paletteIndex = alpha * 4;
        pixels[i - 3] = palette[paletteIndex];     // Red
        pixels[i - 2] = palette[paletteIndex + 1]; // Green
        pixels[i - 1] = palette[paletteIndex + 2]; // Blue
        // Smoothly boost display opacity so low-density tails remain legible
        pixels[i] = Math.min(255, Math.round(alpha * 1.15));
      } else {
        pixels[i] = 0;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }
}

/**
 * Helper factory function
 */
export function createKdeHeatmapLayer(latlngs, options) {
  return new KdeHeatmapLayer(latlngs, options);
}
