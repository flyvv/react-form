import { action, observable, runInAction, toJS } from 'mobx';
import { FieldType } from './enum';
import { Field, FormModel } from './model';
import { observableSetIn } from './common-utils';
import { FieldValidateTrigger, FormEnvContextType, SubmitOptions } from './type';

export const modelUtils = {
  clearError: action(function <T>(model: FormModel<T>) {
    model.iterateFields((field) => {
      field.state.error = null;
    });
    model.iterateChecks((check) => {
      check.error = null;
    });
  }),

  scrollToFirstError(errorFields: Field[]) {
    for (const field of errorFields) {
      if (!field.config?.htmlId) {
        continue;
      }
      const div = document.querySelector<HTMLDivElement>(
        `*[data-xform-id="${field.config.htmlId}"]`
      );
      if (!div) {
        continue;
      }

      if (typeof (div as any).scrollIntoViewIfNeeded === 'function') {
        (div as any).scrollIntoViewIfNeeded();
      } else {
        div.scrollIntoView({ block: 'nearest' });
      }

      return;
    }
  },

  animateErrorFields(errorFields: Field[]) {
    for (const field of errorFields) {
      if (!field.config?.htmlId) {
        continue;
      }
      const div = document.querySelector<HTMLDivElement>(
        `*[data-xform-id="${field.config.htmlId}"]`
      );
      if (!div) {
        continue;
      }

      div.animate(
        [
          { offset: 0, transform: 'translateX(0)' },
          { offset: 0.065, transform: 'translateX(-6px) rotateY(-9deg)' },
          { offset: 0.185, transform: 'translateX(5px) rotateY(7deg)' },
          { offset: 0.315, transform: 'translateX(-3px) rotateY(-5deg)' },
          { offset: 0.435, transform: 'translateX(2px) rotateY(3deg)' },
          { offset: 0.5, transform: 'translateX(0)' },
        ],
        { duration: 750 }
      );
    }
  },

  validateAll: action(function <T>(model: FormModel<T>, trigger: FieldValidateTrigger = '*') {
    let hasError = false;
    const errors: any = observable(model._valueShape === 'array' ? [] : {});
    const errorFields: Field[] = [];

    const promises: Promise<unknown>[] = [];

    model.iterateFields((field) => {
      if (!field.isMounted) {
        return;
      }
      promises.push(
        field.validate(trigger).then(
          action((error) => {
            if (error) {
              hasError = true;
              observableSetIn(errors, field.path, error);
              errorFields.push(field);
            }
          })
        )
      );
    });

    model.iterateChecks((check) => {
      promises.push(
        check.validate().then(
          action((error) => {
            if (error) {
              hasError = true;
              observableSetIn(errors, check.path, error);
            }
          })
        )
      );
    });

    return Promise.all(promises).then(() => ({
      hasError,
      errors: toJS(errors),
      errorFields,
    }));
  }),

  submit: action(async function <T>(model: FormModel<T>, options: SubmitOptions = {}) {
    const {
      onError,
      onSubmit,
      valueFilter = 'mounted',
      mergeDefaultValue = true,
      animateErrorFields = false,
      scrollToFirstError = true,
    } = options;

    const { hasError, errors, errorFields } = await modelUtils.validateAll(model);

    if (hasError) {
      if (scrollToFirstError) {
        modelUtils.scrollToFirstError(errorFields);
      }
      if (animateErrorFields) {
        modelUtils.animateErrorFields(errorFields);
      }

      onError?.(errors, model);
    } else if (typeof onSubmit === 'function') {
      runInAction(() => {
        const result: any = observable(
          valueFilter === 'all' ? toJS(model.values) : model._valueShape === 'array' ? [] : {}
        );

        _mergeValuesFromViewToTarget(result, model, { mergeDefaultValue });

        onSubmit(toJS(result), model);
      });
    }
  }),

  reset: action(function <T>(
    model: FormModel<T>,
    { onReset }: Pick<FormEnvContextType, 'onReset'> = {}
  ) {
    model.values = {} as T;
    modelUtils.clearError(model);
    onReset?.(model);
  }),

  acceptValuesFormView: action((model: FormModel, opts: { mergeDefaultValue?: boolean } = {}) => {
    _mergeValuesFromViewToTarget(model.values, model, opts);
  }),

  mergeValuesFromViewToView: _mergeValuesFromViewToTarget,
};

/** 遍历 model 下当前挂载的 field 对象，将字段值或字段默认值写入到 target 中 */
function _mergeValuesFromViewToTarget(
  target: any,
  model: FormModel,
  { mergeDefaultValue = true }: { mergeDefaultValue?: boolean } = {}
) {
  model.iterateFields((field) => {
    if (!field.isMounted) {
      return;
    }

    if (field.fieldType === FieldType.normal) {
      if (field.config.valueProp !== undefined) {
        // 如果对应的 FormItem 上已经指定了 value，则将其合并到结果中
        observableSetIn(target, field.path, field.config.valueProp);
      } else if (field.value !== undefined) {
        // 如果该字段有值，则将其合并到结果中
        observableSetIn(target, field.path, field.value);
      } else {
        // 否则尝试将 FormItem 上的 defaultValue 合并到结果中
        const defaultValueProp = field.config.defaultValueProp;
        if (mergeDefaultValue && defaultValueProp !== undefined) {
          observableSetIn(target, field.path, defaultValueProp);
        }
      }
    } else if (field.fieldType === FieldType.tuple) {
      const model = field.parent;
      // hasValue 表示元祖字段是否有值
      const hasValue = (field.value as unknown[]).some((v) => v !== undefined);
      if (hasValue) {
        // 如果该字段有值，则将其合并到结果中
        field._tupleParts.map((part, index) => {
          observableSetIn(target, [...model.path, part], field.value[index]);
        });
      } else {
        const defaultValueProp = field.config.defaultValueProp;
        // 否则尝试将 FormItem 上的 defaultValue 合并到结果中
        if (mergeDefaultValue && defaultValueProp !== undefined) {
          field._tupleParts.map((part, index) => {
            observableSetIn(target, [...model.path, part], defaultValueProp?.[index]);
          });
        }
      }
    }
    // 其他类型的 field 会被忽略
  });
}
