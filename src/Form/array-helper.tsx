import { action } from 'mobx';
import invariant from 'invariant';
import { Form } from './index';
import { FormModel } from './model';
import { composeValue } from './common-utils';
import { FormArrayLayoutInput } from './type';

function invariantArrayShapeIsAutoOrArray(arrayModel: FormModel<unknown[]>) {
  invariant(
    arrayModel._valueShape === 'auto' || arrayModel._valueShape === 'array',
    'arrayModel._valueShape should be "auto" or "array"',
  );
}

function updateSubModelsNames(arrayModel: FormModel<unknown[]>) {
  arrayModel._subModels.forEach((mod, index) => {
    mod.name = String(index);
  });
}

function reorderInPlace<T>(list: T[], fromIndex: number, toIndex: number) {
  if (list == null) {
    return;
  }
  const [movingItem] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, movingItem);
}

function swapInPlace<T>(values: T[], a: number, b: number) {
  if (values == null) {
    return;
  }
  const temp = values[a];
  values[a] = values[b];
  values[b] = temp;
}

export const arrayHelpers = {
  append: action((arrayModel: FormModel<unknown[]>, itemFactory?: any) => {
    if (arrayModel.values == null) {
      arrayModel.values = [];
    }
    const value = composeValue(
      typeof itemFactory === 'function' ? itemFactory(arrayModel) : itemFactory,
      {},
    );
    arrayModel.values.push(value);
  }),

  delete: action((arrayModel: FormModel<unknown[]>, itemIndex: number) => {
    invariantArrayShapeIsAutoOrArray(arrayModel);
    if (Array.isArray(arrayModel.values)) {
      arrayModel.values.splice(itemIndex, 1);
    }
    if (Array.isArray(arrayModel._subModels)) {
      const [subModel] = arrayModel._subModels.splice(itemIndex, 1);
      subModel._markDeleted();
      updateSubModelsNames(arrayModel);
    }
  }),

  moveUp: action((arrayModel: FormModel<unknown[]>, itemIndex: number) => {
    invariantArrayShapeIsAutoOrArray(arrayModel);
    if (itemIndex === 0) {
      return;
    }

    if (Array.isArray(arrayModel.values)) {
      swapInPlace(arrayModel.values, itemIndex, itemIndex - 1);
    }
    if (Array.isArray(arrayModel._subModels)) {
      swapInPlace(arrayModel._subModels, itemIndex, itemIndex - 1);
      updateSubModelsNames(arrayModel);
    }
  }),

  moveDown: action((arrayModel: FormModel<unknown[]>, itemIndex: number) => {
    invariantArrayShapeIsAutoOrArray(arrayModel);
    if (Array.isArray(arrayModel.values)) {
      if (itemIndex === arrayModel.values.length - 1) {
        return;
      }
      swapInPlace(arrayModel.values, itemIndex, itemIndex + 1);
    }

    if (Array.isArray(arrayModel._subModels)) {
      swapInPlace(arrayModel._subModels, itemIndex, itemIndex + 1);
      updateSubModelsNames(arrayModel);
    }
  }),

  clear: action((arrayModel: FormModel<unknown[]>) => {
    invariantArrayShapeIsAutoOrArray(arrayModel);

    if (arrayModel.values == null || arrayModel.values.length === 0) {
      return;
    }
    arrayModel.values = [];

    if (Array.isArray(arrayModel)) {
      arrayModel._subModels.forEach((subModel) => {
        subModel._markDeleted();
      });
      arrayModel._subModels.length = 0;
    }
  }),

  move: action(
    (arrayModel: FormModel<unknown[]>, fromIndex: number, toIndex: number) => {
      invariantArrayShapeIsAutoOrArray(arrayModel);

      if (Array.isArray(arrayModel.values)) {
        reorderInPlace(arrayModel.values, fromIndex, toIndex);
      }

      if (Array.isArray(arrayModel._subModels)) {
        reorderInPlace(arrayModel._subModels, fromIndex, toIndex);
        updateSubModelsNames(arrayModel);
      }
    },
  ),

  renderArrayItem(
    arrayModel: FormModel<unknown[]>,
    itemIndex: number,
    itemContent: FormArrayLayoutInput['itemContent'],
  ) {
    const itemModel: any = arrayModel.getSubModel(itemIndex);
    return (
      <Form.ModelProvider key={itemModel.id} value={itemModel}>
        {itemContent(itemIndex, itemModel)}
      </Form.ModelProvider>
    );
  },

  getKey(arrayModel: FormModel<unknown[]>, itemIndex: number) {
    return arrayModel.getSubModel(itemIndex).id;
  },
};
