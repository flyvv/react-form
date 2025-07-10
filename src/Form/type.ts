import { ReactNode } from 'react';
import { Field, FormModel } from './model';
import { FieldType, ModelType } from './enum';

type valueOf<T> = T[keyof T];

export type XName<D> =
  // 只有 D 为 any 的情况下这个判断才会成立
  0 extends D & 1
    ? any
    : D extends (infer U)[]
    ? number | `${number}` | `${number}.${XName<U>}`
    : D extends object
    ? valueOf<{ [K in keyof D & string]: K | `${K}.${XName<D[K]>}` }>
    : never;

type IfAny<T, TRUE, FALSE> = 0 extends T & 1 ? TRUE : FALSE;

export type ResolveXName<D, Path extends string | number> =
  // 只有 Path 为 any 的情况下这个判断才会成立
  // 这里这么做是为了将 any 传染出去，不然会变成「any 进来，unknown 出去」
  0 extends Path & 1
    ? any
    : string extends Path
    ? IfAny<D, any, unknown>
    : Path extends number
    ? D extends Array<infer U>
      ? U
      : unknown
    : Path extends keyof D
    ? D[Path]
    : Path extends `${infer K}.${infer R}`
    ? K extends keyof D
      ? ResolveXName<D[K], R>
      : unknown
    : unknown;

export type ValueShape = 'array' | 'object';

export type FieldValidateTrigger = '*' | 'blur' | 'change' | 'mount';

export interface FieldConfig<D> {
  htmlId?: string;
  label?: React.ReactNode;
  help?: React.ReactNode;
  tip?: React.ReactNode;
  asterisk?: boolean;
  afterChange?(...args: any[]): void;
  /** 覆盖 FormItem 上的错误信息 */
  error?: React.ReactNode;
  /** 在 `<FormItem />` 上设置的 props.value（也可能是 props.checked，取决于组件类型） */
  valueProp?: any;
  defaultValue?: any;
  /** 在 `<FormItem />` 上设置的 props.defaultValue */
  defaultValueProp?: any;
  isEmpty?(value: any): boolean;
  required?: boolean;
  requiredMessage?: string;
  writeDefaultValueToModel?: boolean | 'force';
  autoUnmount?: boolean;
  validate?(
    value: any,
    field: Field<D>,
    trigger: FieldValidateTrigger
  ): undefined | null | string | Promise<any>;
  validateOnMount?: boolean;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  status?: string;
  // 其他更多字段由上层自定义（TS 层面可以使用 interface merge）
}

export interface CheckConfig<D> {
  validate(values: D, model: FormModel<D>): undefined | null | string | Promise<any>;
  validateOnMount?: boolean;
}

export interface FieldState {
  error?: any;
  validating?: boolean;
  cancelValidation?(): void;
  [key: string]: any;
}

type FieldCreateCommon = { parent: FormModel; name: string; forkName?: string };
export type FieldCreateOptions =
  | ({ fieldType: FieldType.normal } & FieldCreateCommon)
  | ({ fieldType: FieldType.tuple; tupleParts: string[] } & FieldCreateCommon)
  | ({ fieldType: FieldType.readonly; value: any } & FieldCreateCommon);

export type FormModelCreateOptions =
  | { modelType: ModelType.rootModel }
  | { modelType: ModelType.subModel; parent: FormModel; name: string };

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

export interface FormLayoutParams {
  /** 标签位置，可选 'left' 或 'top'  */
  labelPosition?: 'left' | 'top';
  /** 标签宽度 */
  labelWidth?: string | number;
  /** 控件宽度 */
  controlWidth?: string | number;
  /** 两个 form item 之间的间距 */
  formItemGap?: string | number;
  /** labelPosition=top 时，是否内联展示 error 消息 */
  inlineError?: boolean;
}

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

export interface FormLayoutParams {
  /** 标签位置，可选 'left' 或 'top'  */
  labelPosition?: 'left' | 'top';
  /** 标签宽度 */
  labelWidth?: string | number;
  /** 控件宽度 */
  controlWidth?: string | number;
  /** 两个 form item 之间的间距 */
  formItemGap?: string | number;
  /** labelPosition=top 时，是否内联展示 error 消息 */
  inlineError?: boolean;
}

export interface FormLayoutProps extends Partial<FormLayoutParams> {
  style?: React.CSSProperties;
  className?: string;
  children?: ReactNode;
  containerProps?: any;
  defaultLabelTopPosition?: number | string;
}

export interface FormItemGroupProps {
  label?: React.ReactNode;
  tip?: React.ReactNode;
  asterisk?: boolean;
  children?: React.ReactNode;
  labelWidth?: number | string;
  labelTopPosition?: number | string;
  controlWidth?: number | string;
  className?: string;
  style?: React.CSSProperties;
  inline?: boolean;
}

export interface FormItemComponentProps {
  value?: any;
  onChange?(...args: any[]): void;
  onFocus?(...args: any[]): void;
  onBlur?(...args: any[]): void;
  readOnly?: any;
  disabled?: any;
  isPreview?: any;
  [prop: string]: any;
}

export interface FormItemCreationOptions {
  /** 名称 */
  name: string;
  /** 是否为隐藏元素 */
  hidden?: boolean;
  /** 是否需要将 field 对象传递给组件 */
  withField?: boolean;
  /** 控件对应的 React 组件，例如 `<FormItem component="select" />` 对应 `Select` 组件. */
  component?: React.ComponentType<FormItemComponentProps>;
  /** 控件渲染方法，与 component 参数二选一，优先级高于 component */
  render?(arg: FormItemComponentProps): React.ReactElement;
  /** 组件值的属性名称，默认为 `'value'` */
  valuePropName?: string;
  /** 组件状态值的属性名称，默认为 `'state'` */
  statusPropName?: string;
  /** 预览态下组件的渲染方法。如果不设置该方法，预览态下将使用 render/component 作为后备方案. */
  renderPreview?(props: FormItemComponentProps): React.ReactNode;
  /** 默认值 */
  defaultValue?: any;
  /** 组件类型默认的空值判断方法 */
  isEmpty?(value: any): boolean;
  /** 组件是否具有固有宽度，默认为 true。该选项为 true 时，controlWidth 将不对组件产生效果 */
  hasIntrinsicWidth?: boolean;
}

export interface FormItemProps
  extends Omit<FieldConfig<any>, 'defaultValueProp' | 'valueProp' | 'htmlId'> {
  use?: boolean;
  component: string | React.ComponentType<FormItemComponentProps>;
  componentProps?: any;
  dataSource?: any;
  style?: React.CSSProperties;
  className?: string;
  name?: string;
  field?: Field;
  value?: any;
  onChange?(nextValue: any): void;
  onFocus?(): void;
  onBlur?(): void;
  renderPreview?(props: FormItemProps): React.ReactNode;
  labelWidth?: number | string;
  labelTopPosition?: number | string;
  controlWidth?: number | string;
  labelStyle?: React.CSSProperties;
  controlStyle?: React.CSSProperties;
  rightNode?: React.ReactNode;
  isPreview?: boolean;
}

export interface FormItemViewProps {
  /** `<label />` 的 id 属性 */
  htmlId?: string;
  /** 标签 */
  label?: React.ReactNode;
  /** 帮助文本 */
  help?: React.ReactNode;
  /** 提示信息 */
  tip?: React.ReactNode;
  /** 是否展示「*」 */
  asterisk?: boolean;
  /** 错误信息 */
  error?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  /** 标签宽度 */
  labelWidth?: string | number;
  /** 标签内联样式 */
  labelStyle?: React.CSSProperties;
  /** 控件宽度 */
  controlWidth?: string | number;
  /** 控件内联样式 */
  controlStyle?: React.CSSProperties;
  /** 在控件右侧添加自定义内容 */
  rightNode?: React.ReactNode;
}

export type SubmitExtraOptions = {
  valueFilter?: 'mounted' | 'all';
  mergeDefaultValue?: boolean;
  scrollToFirstError?: boolean;
  animateErrorFields?: boolean;
};

export type SubmitOptions = Pick<FormEnvContextType, 'onSubmit' | 'onError'> & SubmitExtraOptions;

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
  children?:
    | React.ReactNode
    | ((index: number, model: FormModel<T>) => React.ReactNode);
}
