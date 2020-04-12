import EventEmitter from 'tiny-emitter';
import { drawRect, getRectSize, setRectSize, parseRectFragment } from '../annotations/RectFragment';
import { SVG_NAMESPACE } from '../SVGConst';

const drawHandle = (x, y, className) => {
  const rect  = document.createElementNS(SVG_NAMESPACE, 'rect'); 
  
  rect.setAttribute('x', x - 4);
  rect.setAttribute('y', y - 4);
  rect.setAttribute('width', 8);
  rect.setAttribute('height', 8);
  rect.setAttribute('class', `resize-handle ${className}`);

  return rect;
}

const setHandleXY = (handle, x, y) => {
  handle.setAttribute('x', x - 4);
  handle.setAttribute('y', y - 4);
}

const getCorners = g => {
  const { x, y, w, h } = getRectSize(g);
  return [
    { x: x,     y: y },
    { x: x + w, y: y },
    { x: x + w, y: y + h },
    { x: x,     y: y + h}
  ];
}

const stretchCorners = (corner, opposite) => {
  const x1 = corner.x;
  const y1 = corner.y;

  const x2 = opposite.x;
  const y2 = opposite.y;

  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  return { x, y, w, h };
}

/**
 * An editable rectangle shape.
 */
export default class EditableRect extends EventEmitter {

  constructor(annotation, svg) {
    super();

    this.annotation = annotation;
    this.svg = svg;

    const { x, y, w, h } = parseRectFragment(annotation);

    this.g = drawRect(x, y, w, h);
    this.g.setAttribute('class', 'a9s-annotation editable');

    this.g.querySelector('.inner')
      .addEventListener('mousedown', this.onGrab(this.g));
    
    this.svg.addEventListener('mousemove', this.onMouseMove);
    this.svg.addEventListener('mouseup', this.onMouseUp);

    this.handles = [
      [ x,     y,     'topleft' ], 
      [ x + w, y,     'topright'], 
      [ x + w, y + h, 'bottomright' ], 
      [ x,     y + h, 'bottomleft' ]
    ].map(t => { 
      const [ x, y, className ] = t;
      const handle = drawHandle(x, y, className);

      handle.addEventListener('mousedown', this.onGrab(handle));
      this.g.appendChild(handle);

      return handle;
    });

    this.svg.appendChild(this.g);

    // The grabbed element (handle or entire group), if any
    this.grabbedElem = null; 

    // Mouse xy offset inside the shape, if mouse pressed
    this.mouseOffset = null;
  }

  /** Sets the shape size, including handle positions **/
  setSize = (x, y, w, h) => {
    setRectSize(this.g, x, y, w, h);

    const [ topleft, topright, bottomright, bottomleft] = this.handles;
    setHandleXY(topleft, x, y);
    setHandleXY(topright, x + w, y);
    setHandleXY(bottomright, x + w, y + h);
    setHandleXY(bottomleft, x, y + h);
  }

  /** Converts mouse coordinates to SVG coordinates **/
  getMousePosition = evt => {
    const pt = this.svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  onGrab = grabbedElem => evt => {
    this.grabbedElem = grabbedElem; 
    const pos = this.getMousePosition(evt);
    const { x, y } = getRectSize(this.g);
    this.mouseOffset = { x: pos.x - x, y: pos.y - y };  
  }

  onMouseMove = evt => {
    if (this.grabbedElem) {
      const pos = this.getMousePosition(evt);

      if (this.grabbedElem === this.g) {
        // x/y changes by mouse offset, w/h remains unchanged
        const { w, h } = getRectSize(this.g);
        const x = pos.x - this.mouseOffset.x;
        const y = pos.y - this.mouseOffset.y;

        this.setSize(x, y, w, h); 
        this.emit('update', { x, y, w, h }); 
      } else {
        // Handles
        const corners = getCorners(this.g);

        // Mouse position replaces one of the corner coords, depending
        // on which handle is the grabbed element
        const handleIdx = this.handles.indexOf(this.grabbedElem);
        const oppositeCorner = handleIdx < 2 ? 
          corners[handleIdx + 2] : corners[handleIdx - 2];

        const { x, y, w, h } = stretchCorners(pos, oppositeCorner)

        this.setSize(x, y, w, h); 
        this.emit('update', { x, y, w, h }); 
      }
    }
  }

  onMouseUp = evt => {
    this.grabbedElem = null;
    this.mouseOffset = null;
  }

  getBoundingClientRect = () => 
    this.g.getBoundingClientRect();

  destroy = () =>
    this.g.parentNode.removeChild(this.g);

}