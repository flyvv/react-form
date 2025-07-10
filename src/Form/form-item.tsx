import React, { useEffect, useLayoutEffect } from 'react';
import cx from 'classnames';
import pick from 'lodash/pick';
import { observer } from 'mobx-react-lite';
import stringifyObject from 'stringify-object';
import { reaction, runInAction, toJS } from 'mobx';
import { FieldType } from './enum';
import { Field, FormModel } from './model';
import { useModel } from './context/modelContext';
import { useFormEnv } from './context/formEnvContext';
import { ALL_COMPONENTS } from './form-ui/default-component';
import { composeValue, isFalsyOrEmptyArray, asCSSLength } from './common-utils';
import {
  FormItemCreationOptions,
  FormItemProps,
  FieldConfig,
  FormItemViewProps,
  FormItemComponentProps,
} from './type';

function processCreationOptions(
  options: FormItemCreationOptions
): Required<Omit<FormItemCreationOptions, 'component'>> {
  const render = options.render ?? ((props) => React.createElement(options.component, props));
  return {
    name: options.name,
    hidden: options.hidden,
    withField: Boolean(options.withField),
    statusPropName: composeValue(options.statusPropName, 'state'),
    valuePropName: composeValue(options.valuePropName, 'value'),
    hasIntrinsicWidth: options.hasIntrinsicWidth !== false,
    defaultValue: Object.keys(options).includes('defaultValue') ? options.defaultValue : null,
    isEmpty: options.isEmpty ?? isFalsyOrEmptyArray,
    render: render,
    renderPreview: options.renderPreview ?? render,
  };
}

function resolveField(fieldProp: Field<any>, model: FormModel<any>, name: string, valueProp: any) {
  let field: Field<any>;
  if (fieldProp != null) {
    field = fieldProp;
  } else if (name === '&') {
    field = model._asField();
  } else if (name != null) {
    field = model.getField(name);
  } else {
    // readonly field 每次都会重新生成
    field = new Field({
      fieldType: FieldType.readonly,
      value: valueProp,
      name: '(readonly)',
      forkName: Field.ORIGINAL,
      parent: model,
    });
  }

  return field;
}

export function FormItemView({
  htmlId,
  label = '',
  help,
  tip,
  asterisk,
  error,
  children,
  className,
  style,
  labelWidth,
  controlWidth,
  rightNode,
  labelStyle,
  controlStyle,
}: FormItemViewProps) {
  return (
    <div
      data-xform-id={htmlId}
      className={cx('form-item', className)}
      style={
        {
          '--label-width': asCSSLength(labelWidth),
          '--control-width': asCSSLength(controlWidth),
          ...style,
        } as any
      }
    >
      {label == null && tip == null ? null : (
        <label className="form-item-label" htmlFor={htmlId} style={labelStyle}>
          {asterisk && <span className="required-indicator" />}
          {label && <span className="form-item-label-text">{label}</span>}
          {/* {tip && <Tip title={tip} />} */}
        </label>
      )}

      <div className="form-item-control" style={controlStyle}>
        {children}
        {help && <div className="help">{help}</div>}
        {error && <div className="error-message">{error}</div>}
      </div>

      {rightNode}
    </div>
  );
}

export function createFormItem(inputOptions: FormItemCreationOptions) {
  const options = processCreationOptions(inputOptions);

  function FormItemComponent({
    defaultValue: defaultValueProp,
    isEmpty = options.isEmpty,
    renderPreview = options.renderPreview,
    componentProps: componentPropsProp,
    name,
    field: fieldProp,
    ...props
  }: Omit<FormItemProps, 'component'>) {
    const formEnv = useFormEnv();
    const model = useModel();
    const field = resolveField(fieldProp, model, name, props.value);

    const isPreview = composeValue(props.isPreview, formEnv.isPreview);
    const error = composeValue(props.error, field.state.error);
    const defaultValue = composeValue(defaultValueProp, options.defaultValue);
    const value = toJS(composeValue(field.value, defaultValue));
    const htmlId = Field.getHtmlId(formEnv.htmlIdPrefix, field);

    const componentProps = {
      id: htmlId,
      ...(isPreview ? { isPreview: true } : null),
      // dataSource, readOnly, disabled,options 允许直接透传
      ...pick(props, ['dataSource', 'readOnly', 'disabled', 'options']),
      ...componentPropsProp,
      // status 优先用 prop 中的值，然后再根据 error 自动判断
      [options.statusPropName]: composeValue(
        componentPropsProp?.[options.statusPropName],
        composeValue(props[options.statusPropName], error ? 'error' : undefined)
      ),
      [options.valuePropName]: composeValue(props[options.valuePropName], value),
      onChange: composeValue(props.onChange, field.handleChange),
      onFocus: composeValue(props.onFocus, field.handleFocus),
      onBlur: composeValue(props.onBlur, field.handleBlur),
    };
    if (options.withField) {
      componentProps.field = field;
    }

    const fieldConfig: FieldConfig<unknown> = {
      htmlId,
      valueProp: props[options.valuePropName],
      defaultValue,
      defaultValueProp,
      isEmpty,
      validateOnChange: formEnv.validateOnChange,
      validateOnBlur: formEnv.validateOnBlur,
      validateOnMount: formEnv.validateOnMount,
      writeDefaultValueToModel: formEnv.writeDefaultValueToModel,
      autoUnmount: formEnv.autoUnmount,
      ...props,
    };

    // 利用 useLayoutEffect 将 fieldConfig 设置到 field.config 上
    useLayoutEffect(() => field._track(fieldConfig));

    // 处理 writeDefaultValueToModel 与 autoUnmount
    useLayoutEffect(() => {
      if (fieldConfig.writeDefaultValueToModel === 'force') {
        return reaction(
          () => field.value,
          () => {
            if (field.value === undefined && fieldConfig.defaultValueProp !== undefined) {
              field.value = fieldConfig.defaultValueProp;
            }
          },
          { fireImmediately: true }
        );
      } else if (fieldConfig.writeDefaultValueToModel) {
        if (field.value === undefined && fieldConfig.defaultValueProp !== undefined) {
          // 注意只有「不为 undefined」且「通过 FormItem props 设置的」的默认值才会被回写到 model 中
          runInAction(() => {
            field.value = fieldConfig.defaultValueProp;
          });
        }
      }

      return () => {
        if (fieldConfig.autoUnmount) {
          field.clear();
        }
      };
    }, []);

    useEffect(() => {
      if (fieldConfig.validateOnMount) {
        field.validate('mount');
        const cancel = field.state.cancelValidation;
        return () => {
          cancel?.();
        };
      }
    }, []);

    if (options.hidden) {
      // renderHiddenFormItemView 是内部 api，仅用在 arrayTable 和 component=hidden 组合使用的情况
      if ((props as any).renderHiddenFormItemView === false) {
        return null;
      }
    }

    return (
      <FormItemView
        htmlId={htmlId}
        label={props.label}
        help={props.help}
        asterisk={props.asterisk ?? props.required}
        error={error}
        tip={props.tip}
        style={props.style}
        className={cx(props.className, {
          'form-item-hidden': options.hidden,
          'form-item-preview': isPreview,
          'auto-control-width': options.hasIntrinsicWidth,
        })}
        labelWidth={props.labelWidth}
        labelStyle={props.labelStyle}
        controlWidth={props.controlWidth}
        controlStyle={props.controlStyle}
        rightNode={props.rightNode}
      >
        {isPreview ? renderPreview(componentProps) : options.render(componentProps)}
      </FormItemView>
    );
  }

  FormItemComponent.displayName = `FormItem__${options.name}`;

  return observer(FormItemComponent);
}

const COMPONENT_DICT: { [name: string]: React.FunctionComponent<any> } = {};
for (const config of ALL_COMPONENTS) {
  const Component = createFormItem(config);
  COMPONENT_DICT[config.name] = Component;
  // if (config.aliases) {
  //   for (const alias of config.aliases) {
  //     COMPONENT_DICT[alias] = Component;
  //   }
  // }
}

export const AnonymousFormItem = createFormItem({
  name: 'anonymous',
  render({ $Component: Component, ...props }: FormItemComponentProps) {
    return <Component {...props} />;
  },
});

const NotFound = createFormItem({
  name: 'notFound',
  isEmpty: () => false,
  render({ $Component }: FormItemComponentProps) {
    return (
      <div
        style={{
          border: '1px dashed red',
          fontSize: 14,
          padding: 4,
          color: 'red',
        }}
      >
        <code>&lt;FormItem component='{$Component}' /&gt;</code>{' '}
        没有找到对应组件，请检查组件名称是否拼写正确
      </div>
    );
  },
});

const Hidden = createFormItem({
  name: 'hidden',
  hidden: true,
  hasIntrinsicWidth: false,
  defaultValue: undefined,
  isEmpty() {
    return false;
  },
  render({ id, value }) {
    return <input type="hidden" value={stringifyObject(value)} id={id} />;
  },
});

export function FormItem({ use, component, ...props }: FormItemProps) {
  if (use === false) {
    return null;
  }
  if (component == null) {
    return <NotFound {...props} componentProps={{ $Component: String(component) }} />;
  } else if (typeof component === 'string') {
    if (component === 'hidden') {
      return <Hidden {...props} />;
    }
    const Comp = COMPONENT_DICT[component];
    if (Comp == null) {
      return <NotFound {...props} componentProps={{ $Component: component }} />;
    }
    return React.createElement(Comp, props);
  } else {
    return (
      <AnonymousFormItem
        {...props}
        componentProps={{ ...props.componentProps, $Component: component }}
      />
    );
  }
}
