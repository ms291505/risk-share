import type { GroupKey } from '../../state/amountSets'

/** Ids of the elements that receive focus after an action. The page has one editor, so they're unique. */
export const focusIds = {
  newAmountSet: 'new-amount-set',
  list: 'amount-set-list',
  name: 'amount-set-name',
  componentName: (id: string) => `component-${id}-name`,
  removeComponent: (id: string) => `component-${id}-remove`,
  addComponent: (key: GroupKey) => `add-${key}-component`,
}

export function focusById(id: string): void {
  document.getElementById(id)?.focus()
}
