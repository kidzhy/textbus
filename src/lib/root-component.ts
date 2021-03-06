import { forwardRef, Inject, Injectable } from '@tanbo/di';
import {
  AbstractComponent,
  TBClipboard,
  Component,
  DivisionAbstractComponent,
  Fragment,
  InlineFormatter,
  LeafAbstractComponent,
  Interceptor,
  TBEvent,
  TBSelection,
  VElement,
  BlockFormatter,
  FormatRange,
  BrComponent,
  ContextMenuAction,
  ComponentLoader,
  ViewData,
} from './core/_api';
import { Input } from './workbench/input';
import { BlockComponent } from './components/_api';
import { EditorController } from './editor-controller';

@Injectable()
class RootComponentInterceptor implements Interceptor<RootComponent> {
  private selectionSnapshot: TBSelection;
  private contentSnapshot: Array<AbstractComponent | string> = [];
  private formatterSnapshot = new Map<BlockFormatter | InlineFormatter, FormatRange[]>();

  constructor(@Inject(forwardRef(() => TBSelection)) private selection: TBSelection,
              @Inject(forwardRef(() => Input)) private input: Input,
              @Inject(forwardRef(() => RootComponent)) private rootComponent: RootComponent,
              @Inject(forwardRef(() => EditorController)) private editorController: EditorController) {
  }

  onContextmenu(): ContextMenuAction[] {
    if (this.editorController.sourceCodeMode) {
      return [];
    }
    return [{
      iconClasses: ['textbus-icon-insert-paragraph-before'],
      label: '在前面插入段落',
      action: () => {
        this.insertParagraph(true)
      }
    }, {
      iconClasses: ['textbus-icon-insert-paragraph-after'],
      label: '在后面插入段落',
      action: () => {
        this.insertParagraph(false)
      }
    }]
  }

  onInputReady() {
    this.recordSnapshotFromEditingBefore();
  }

  onInput() {
    const selection = this.selection;
    const startIndex = this.selectionSnapshot.firstRange.startIndex as number;
    const latestFragment = new Fragment();

    this.contentSnapshot.forEach(i => latestFragment.append(i));

    this.formatterSnapshot.forEach((formatRanges, key) => {
      if (key instanceof InlineFormatter) {
        formatRanges.forEach(formatRange => {
          latestFragment.apply(key, {
            ...formatRange,
            formatData: formatRange.formatData?.clone()
          })
        })
      } else {
        formatRanges.forEach(formatRange => {
          latestFragment.apply(key, {
            get startIndex() {
              return 0;
            },
            get endIndex() {
              return latestFragment.length;
            },
            effect: formatRange.effect,
            formatData: formatRange.formatData?.clone()
          })
        })
      }
    })

    const input = this.input;

    let index = 0;
    input.value.replace(/\n+|[^\n]+/g, (str) => {
      if (/\n+/.test(str)) {
        for (let i = 0; i < str.length; i++) {
          const s = new BrComponent();
          latestFragment.insert(s, index + startIndex);
          index++;
        }
      } else {
        latestFragment.insert(str, startIndex + index);
        index += str.length;
      }
      return str;
    });

    selection.firstRange.startIndex = selection.firstRange.endIndex = startIndex + input.selectionStart;
    const last = latestFragment.getContentAtIndex(latestFragment.length - 1);
    if (startIndex + input.selectionStart === latestFragment.length &&
      last instanceof BrComponent) {
      latestFragment.append(new BrComponent());
    }
    selection.commonAncestorFragment.from(latestFragment);
  }

  onEnter() {
    const firstRange = this.selection.firstRange;
    const rootFragment = firstRange.startFragment;
    rootFragment.insert(new BrComponent(), firstRange.startIndex);
    firstRange.startIndex = firstRange.endIndex = firstRange.startIndex + 1;
    const afterContent = rootFragment.sliceContents(firstRange.startIndex, firstRange.startIndex + 1)[0];
    if (typeof afterContent === 'string' || afterContent instanceof LeafAbstractComponent) {
      return;
    }
    rootFragment.insert(new BrComponent(), firstRange.startIndex);
  }

  onPaste(event: TBEvent<RootComponent, TBClipboard>) {
    const firstRange = this.selection.firstRange;
    const clipboardFragment = event.data.fragment;
    const fragment = firstRange.startFragment;
    const len = clipboardFragment.length;
    fragment.insert(clipboardFragment, firstRange.startIndex);

    firstRange.startIndex = firstRange.endIndex = firstRange.startIndex + len;
  }

  onDeleteRange() {
    this.selection.ranges.forEach(range => {
      range.deleteContents();
    })
  }

  onDelete() {
    this.selection.ranges.forEach(range => {
      range.delete();
    });
  }

  private insertParagraph(insertBefore: boolean) {
    const selection = this.selection;
    if (selection.rangeCount === 0) {
      return;
    }
    const firstRange = selection.firstRange;
    let component = selection.commonAncestorComponent;

    if (component === this.rootComponent) {
      const commonAncestorFragmentScope = firstRange.getCommonAncestorFragmentScope();
      component = insertBefore ?
        commonAncestorFragmentScope.startChildComponent :
        commonAncestorFragmentScope.endChildComponent;
    }

    const parentFragment = component.parentFragment;
    const p = new BlockComponent('p');
    p.slot.append(new BrComponent());

    insertBefore ? parentFragment.insertBefore(p, component) : parentFragment.insertAfter(p, component);

    selection.removeAllRanges();
    firstRange.setStart(p.slot, 0);
    firstRange.collapse();
    selection.addRange(firstRange);
  }

  private recordSnapshotFromEditingBefore() {
    this.selectionSnapshot = this.selection.clone();
    const commonAncestorFragment = this.selectionSnapshot.commonAncestorFragment;
    this.contentSnapshot = commonAncestorFragment.sliceContents();
    this.formatterSnapshot.clear();
    commonAncestorFragment.getFormatKeys().forEach(token => {
      this.formatterSnapshot.set(token, commonAncestorFragment.getFormatRanges(token).map(formatRange => {
        if (token instanceof InlineFormatter) {
          return {
            ...formatRange,
            formatData: formatRange.formatData?.clone()
          }
        }
        return {
          startIndex: 0,
          endIndex: formatRange.endIndex,
          effect: formatRange.effect,
          formatData: formatRange.formatData?.clone()
        }
      }))
    })
  }
}

class RootComponentLoader implements ComponentLoader {
  match(): boolean {
    return false;
  }

  read(): ViewData {
    return {
      component: new RootComponent(),
      slotsMap: []
    };
  }
}

@Component({
  loader: new RootComponentLoader(),
  providers: [{
    provide: Interceptor,
    useClass: RootComponentInterceptor
  }],
  styles: [
    `body{word-break: break-word;}`
  ]
})
@Injectable()
export class RootComponent extends DivisionAbstractComponent {

  constructor() {
    super('body');
  }

  clone(): RootComponent {
    return undefined;
  }

  slotRender(): VElement {
    return undefined;
  }

  render(): VElement {
    return undefined;
  }
}
