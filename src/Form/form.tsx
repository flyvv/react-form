import { IEqualsComparer, reaction, toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { arrayHelpers } from './utils/array-helper';
import { composeValue, range, useHtmlIdPrefix } from './utils/common';
import { FormItemGroup, FormItemView, FormLayout, FormLayoutParams, FormReset, FormSubmit } from './form-ui';
import { AsyncValue } from './helpers/AsyncValue';
import { Field, FormModel, Check, CheckConfig } from './model';

export const ModelContext = React.createContext<FormModel<any>>(null);
ModelContext.displayName = 'ModelContext';
const ModelProvider = ModelContext.Provider;

export function useModel<T = any>() {
  return useContext(ModelContext) as FormModel<T>;
}

// 导出该类型，允许上层通过 interface merge 拓展该类型
export interface FormEnvContextType {
  /** 提交表单时的回调函数，需配合 <Form.Submit /> 使用 */
  onSubmit?(submitValues: any, model: FormModel<any>): void;

  /** 提交表单时的出错回调函数，需配合 <Form.Submit /> 使用 */
  onError?(errors: any, model: FormModel<any>): void;

  /** 清空表单时的回调函数，需配合 <Form.Reset /> 使用 */
  onReset?(model: FormModel<any>): void;

  /**
   * 是否为预览态
   * @default false
   * */
  isPreview?: boolean;

  /**
   * 组件加载时是否触发校验
   * @default false
   * */
  validateOnMount?: boolean;

  /**
   * 值修改时是否触发校验
   * @default true
   * */
  validateOnChange?: boolean;

  /**
   * 组件失去焦点时是否触发校验
   * @default true
   * */
  validateOnBlur?: boolean;

  /**
   * 是否将 FormItem 上的 defaultValue 回写到 model 中.
   * 注意只有「不为 undefined」且「通过 FormItem props 设置的」的默认值才会被回写到 model 中.
   * @default false
   * */
  writeDefaultValueToModel?: boolean | 'force';

  /**
   * FormItem 卸载时，是否自动将对应数据清除
   * @default false
   */
  autoUnmount?: boolean;

  /**
   * 表单内控件的 html id 前缀。
   *
   * 表单会以该属性为前缀为各个控件分配 id 属性，使控件与 html label 标签产生对应关系，点击 label 可以聚焦到相应控件上。
   *
   * 默认情况下，表单内部会自动生成一个随机字符串作为前缀。
   * 将该属性设置为 null 可以关闭 label 关联行为；设置为指定字符串则可使用指定前缀。
   *
   * @see https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/label
   * */
  htmlIdPrefix?: string;
}

const FormEnvContext = React.createContext<FormEnvContextType>({
  isPreview: false,
  validateOnMount: false,
  validateOnBlur: true,
  validateOnChange: true,
  writeDefaultValueToModel: false,
  autoUnmount: false,
});
FormEnvContext.displayName = 'FormEnvContext';
export const useFormEnv = () => useContext(FormEnvContext);
export const FormEnvProvider = ({ children, ...override }: FormEnvContextType & { children: React.ReactNode }) => {
  const parent = useFormEnv();
  return <FormEnvContext.Provider value={{ ...parent, ...override }}>{children}</FormEnvContext.Provider>;
};

export interface FormProps extends FormEnvContextType {
  /** 受控用法。 xform 模型对象，一般由上层通过 new FormModel(...) 创建而成 */
  model?: FormModel;

  /** 非受控用法。 表单的默认值 */
  defaultValue?: unknown;

  /** @category 布局 */
  style?: React.CSSProperties;

  /** @category 布局 */
  className?: string;

  /**
   * 透传给最外层 div 的 props
   * @category 布局
   * */
  containerProps?: React.HTMLProps<HTMLDivElement>;

  /**
   * 表单布局参数
   * @category 布局
   * */
  layout?: FormLayoutParams;

  children?: React.ReactNode;
}

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

export type Watchable<T = any> =
  | (() => T)
  | string
  | Field<T>
  | FormModel<T>
  | AsyncValue<T>
  | Array<string | Field | AsyncValue<any> | FormModel<any>>;

function convertWatchableToExpression(watch: Watchable, model: FormModel<any>) {
  if (typeof watch === 'string') {
    return () => toJS(model.getValue(watch));
  } else if (typeof watch === 'function') {
    return watch;
  } else if (watch instanceof Field) {
    return () => watch.value;
  } else if (watch instanceof FormModel) {
    return () => toJS(watch.values);
  } else if (watch instanceof AsyncValue) {
    return () => watch.current;
  } else if (Array.isArray(watch)) {
    return () => {
      return watch.map((t) => {
        if (typeof t === 'string') {
          return toJS(model.getValue(t));
        } else if (t instanceof AsyncValue) {
          return t.current;
        } else if (t instanceof Field) {
          return t.value;
        } else if (t instanceof FormModel) {
          return toJS(t.values);
        }
      }) as any;
    };
  } else {
    console.warn('[xform] 无法识别的 watch 参数', watch);
  }
}

export interface FormEffectProps<T = any> {
  watch: Watchable<T>;
  effect(value: T, detail: { prev: T; next: T; model: FormModel<any> }): void;
  fireImmediately?: boolean;
  deps?: unknown[];
  equals?: IEqualsComparer<T>;
}

const FormEffect = observer(function FormEffect<T = any>({
  watch,
  effect,
  fireImmediately,
  deps = [],
  equals,
}: FormEffectProps<T>) {
  const model = useModel();

  const effectRef = useRef(effect);
  useEffect(() => {
    effectRef.current = effect;
  });

  useEffect(() => {
    return reaction(
      convertWatchableToExpression(watch, model),
      (next: T, prev: T) => {
        effectRef.current(next, { model, prev, next });
      },
      { fireImmediately, equals },
    );
  }, deps);

  return null as React.ReactElement;
});

export interface FormCheckProps<T = any> extends CheckConfig<T> {
  name?: string;
  check?: Check<T>;
  watch?: Watchable;
  renderError?: boolean | ((error: any) => React.ReactNode);
  deps?: unknown[];
}

const FormCheck = observer(function FormCheck<T = any>({
  name,
  check: checkProp,
  validate,
  watch = [],
  validateOnMount,
  renderError,
  deps = [],
}: FormCheckProps<T>) {
  const formEnv = useFormEnv();
  const model = useModel();

  const check = composeValue(checkProp, model.getCheck(name));

  const checkConfig: CheckConfig<unknown> = {
    validateOnMount: validateOnMount ?? formEnv.validateOnMount,
    validate,
  };

  useLayoutEffect(() => check._track(checkConfig));

  useEffect(() => {
    return reaction(
      convertWatchableToExpression(watch, model),
      () => {
        check.validate();
      },
      { fireImmediately: checkConfig.validateOnMount },
    );
  }, [check, model, ...deps]);

  if (renderError === true) {
    return check.error;
  } else if (typeof renderError === 'function') {
    return renderError(check.error);
  } else {
    return null;
  }
});

const FormModelConsumer = observer(({ children }: React.ConsumerProps<FormModel<any>>) => {
  const model = useModel();
  return children(model) as React.ReactElement;
});

export interface FormArrayLayoutInput {
  /** 数组的表单模型 */
  arrayModel: FormModel<unknown[]>;

  /** 数组长度，即 arrayModel.values.length */
  itemCount: number;

  /** 获取每个数组元素对应的子表单 */
  itemContent(itemIndex: number, itemModel: FormModel<any>): React.ReactNode;
}

export interface FormArrayProps<T> {
  use?: boolean;
  arrayModel?: FormModel<T[]>;
  name?: string;
  layout?(input: FormArrayLayoutInput): React.ReactElement;
  children?: React.ReactNode | ((index: number, model: FormModel<T>) => React.ReactNode);
}

/** 默认的数组布局 */
const defaultArrayLayout = ({ arrayModel, itemContent, itemCount }: FormArrayLayoutInput) => {
  return range(itemCount).map((itemIndex) => arrayHelpers.renderArrayItem(arrayModel, itemIndex, itemContent));
};

/** 对象数组表单 */
const FormArray = observer(
  <T extends any>({ name, children, layout, arrayModel: arrayModelProp, use }: FormArrayProps<T>) => {
    const parent = useModel();
    if (use === false) {
      return null;
    }
    const arrayModel = arrayModelProp ?? ((name === '&' ? parent : parent.getSubModel(name)) as FormModel<T[]>);
    const itemCount = arrayModel.values?.length ?? 0;
    const itemContent: any = typeof children === 'function' ? children : () => children;

    return (
      <ModelProvider value={arrayModel as FormModel<unknown[]>}>
        {(layout ?? defaultArrayLayout)({ arrayModel, itemCount, itemContent })}
      </ModelProvider>
    );
  },
);

/** 为该组件下的 XFormField 添加一个数据字段前缀 */
const FormObject = observer(({ name, children, use }: { children: React.ReactNode; name: string; use?: boolean }) => {
  const parent = useModel();
  if (use === false) {
    return null;
  }

  const model = (name === '&' ? parent : parent.getSubModel(name)) as FormModel;
  return <ModelProvider value={model} children={children} />;
});

Form.Submit = FormSubmit;
Form.Reset = FormReset;
Form.Effect = FormEffect;
Form.Check = FormCheck;
Form.Array = FormArray;
Form.Object = FormObject;
Form.ModelProvider = ModelProvider;
Form.ModelConsumer = FormModelConsumer;
Form.Layout = FormLayout;
Form.ItemGroup = FormItemGroup;
Form.ItemView = FormItemView;