import { Fragment } from './fragment';
import { EditorOptions } from '../editor';
import { RootFragment } from './root-fragment';
import { FormatEffect } from './formatter';

export class Parser {
  constructor(private options: EditorOptions) {
  }

  parse(el: HTMLElement) {
    const rootSlot = new RootFragment();
    this.readTemplate(el, rootSlot);
    return rootSlot;
  }

  private readTemplate(el: Node, slot: Fragment) {
    if (el.nodeType === 1) {
      const templates = this.options.templateTranslators;
      for (const t of templates) {
        if (t.match(el as HTMLElement)) {
          const viewData = t.from(el as HTMLElement);
          slot.append(viewData.template);
          viewData.childrenSlots.forEach(item => {
            if (item.from === el) {
              this.readFormats(item.from, item.toSlot);
            } else {
              this.readTemplate(item.from, item.toSlot);
            }
          })
          return;
        }
      }
      this.readFormats(el as HTMLElement, slot);
    } else if (el.nodeType === 3) {
      slot.append(el.textContent);
    }
  }

  private readFormats(el: HTMLElement, slot: Fragment) {
    const maps = this.options.formatters.map(f => {
      return {
        formatter: f,
        state: f.match(el)
      }
    }).filter(p => p.state !== FormatEffect.Invalid).map(p => {
      return {
        ...p,
        abstractData: p.formatter.read(el as HTMLElement)
      }
    });
    const startIndex = slot.contentLength;
    Array.from(el.childNodes).forEach(child => {
      this.readTemplate(child, slot);
    })
    maps.forEach(item => {
      slot.mergeFormat({
        startIndex,
        endIndex: slot.contentLength,
        renderer: item.formatter,
        abstractData: item.abstractData,
        state: item.state
      })
    })
  }
}