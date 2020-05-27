import { Fragment } from './fragment';
import { VElement } from './element';

export interface SlotMap {
  from: HTMLElement;
  toSlot: Fragment;
}

export interface ViewData {
  template: Template;
  childrenSlots: SlotMap[];
}

export interface TemplateTranslator {
  match(template: HTMLElement): boolean;

  from(template: HTMLElement): ViewData;
}

export abstract class Template {
  readonly length = 1;
  readonly childSlots: Fragment[] = [];
  protected viewMap = new Map<Fragment, VElement>();

  protected constructor() {
  }

  abstract render(): VElement;

  getChildViewBySlot(slot: Fragment) {
    return this.viewMap.get(slot);
  }
}