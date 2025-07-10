
import { observer } from 'mobx-react-lite';
import React, {  useState } from 'react';
import {  FormModel } from './model';
import { composeValue, useHtmlIdPrefix, range } from './common-utils';
import { FormProps, FormArrayProps, FormArrayLayoutInput } from './type';
import { FormEnvProvider } from './context/formEnvContext';
import { ModelProvider } from './context/modelContext';
import { FormLayout } from './layout';
import { FormSubmit } from './form-ui/default-button';
import { useModel } from './context/modelContext';
import { arrayHelpers } from './array-helper';

export function Form({
  model: modelProp,
  defaultValue,
  children,
  className,
  style,
  layout,
  containerProps,
  htmlIdPrefix: htmlIdPrefixProp,
  ...restEnvProps
}: FormProps) {
  const [_model] = useState(() => new FormModel(defaultValue));
  const model = composeValue(modelProp, _model);
  const htmlIdPrefix = useHtmlIdPrefix(htmlIdPrefixProp);

  return (
    <FormEnvProvider htmlIdPrefix={htmlIdPrefix} {...restEnvProps}>
      <ModelProvider value={model}>
        <FormLayout style={style} className={className} containerProps={containerProps} {...layout}>
          {children}
        </FormLayout>
      </ModelProvider>
    </FormEnvProvider>
  );
}

const FormModelConsumer = observer(({ children }: React.ConsumerProps<FormModel<any>>) => {
  const model = useModel();
  return children(model) as React.ReactElement;
});

/** 默认的数组布局 */
const defaultArrayLayout = ({ arrayModel, itemContent, itemCount }: FormArrayLayoutInput) => {
  return range(itemCount).map((itemIndex) =>
    arrayHelpers.renderArrayItem(arrayModel, itemIndex, itemContent)
  );
};

/** 对象数组表单 */
const FormArray = observer(
  <T extends any>({
    name,
    children,
    layout,
    arrayModel: arrayModelProp,
    use,
  }: FormArrayProps<T>) => {
    const parent = useModel();
    if (use === false) {
      return null;
    }
    const arrayModel =
      arrayModelProp ?? ((name === '&' ? parent : parent.getSubModel(name)) as FormModel<T[]>);
    const itemCount = arrayModel.values?.length ?? 0;
    const itemContent: any = typeof children === 'function' ? children : () => children;

    return (
      <ModelProvider value={arrayModel as FormModel<unknown[]>}>
        {(layout ?? defaultArrayLayout)({ arrayModel, itemCount, itemContent })}
      </ModelProvider>
    );
  }
);

/** 为该组件下的 XFormField 添加一个数据字段前缀 */
const FormObject = observer(
  ({ name, children, use }: { children: React.ReactNode; name: string; use?: boolean }) => {
    const parent = useModel();
    if (use === false) {
      return null;
    }

    const model = (name === '&' ? parent : parent.getSubModel(name)) as FormModel;
    return <ModelProvider value={model} children={children} />;
  }
);

Form.Submit = FormSubmit;
Form.ModelConsumer = FormModelConsumer;
Form.ModelProvider = ModelProvider;
Form.Array = FormArray;
Form.Object = FormObject;
