import invariant from 'invariant';
import React from 'react';
import { Form, FormArrayLayoutInput } from '../form';

const invariantArrayShapeIsAutoOrArray = (arrayModel: FormModel<unknown[]>) => {
  invariant(
    ['auto', 'array'].includes(arrayModel._valueShape),
    'arrayModel._valueShape should be "auto" or "array"',
  );
};

export const arrayHelpers = {
  renderArrayItem: (
    arrayModel: FormModel<unknown[]>,
    itemIndex: number,
    itemContent: FormArrayLayoutInput['itemContent'],
  ) => {
    const itemModel = arrayModel.getSubModel(itemIndex);
    return (
      <Form.ModelProvider key={itemModel.id} value={itemModel}>
        {itemContent(itemIndex, itemModel)}
      </Form.ModelProvider>
    );
  },
};
