import invariant from 'invariant';
import { action, computed, makeObservable, observable, toJS } from 'mobx';
import { ModelType, FieldType } from './enum';
import {
  splitToPath,
  composeValue,
  observableGetIn,
  observableSetIn,
  keyToValueShape,
} from './common-utils';
import {
  XName,
  ResolveXName,
  ValueShape,
  FieldConfig,
  CheckConfig,
  FieldState,
  FieldCreateOptions,
  FieldValidateTrigger,
  FormModelCreateOptions,
} from './type';

const EMPTY_PATH = [] as string[];
const ROOT_MODEL_CREATE_OPTIONS: FormModelCreateOptions = {
  modelType: ModelType.rootModel,
};

class IdGenerator {
  private _nextId = 1;
  private prefix: string;
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  getNextId() {
    return `${this.prefix}_${this._nextId++}`;
  }
}

export class FormModel<D extends { [key: string]: any } = unknown> implements FormModel<D> {
  _modelIdGenerator: IdGenerator;
  _fieldIdGenerator: IdGenerator;

  public readonly id: string;
  public state: any = {};
  public readonly root: FormModel<any>;
  public readonly parent: FormModel<any>;
  public name: string;

  /** 当前 Model 的类型，目前只有两种类型： rootModel 和 subModel */
  _modelType: ModelType;
  _values: D;
  _fieldMap = new Map<string, Field>();
  _valueShape: 'auto' | ValueShape = 'auto';
  _subModels: D extends any[] ? FormModel[] : { [key: string]: FormModel };
  _checkMap = new Map<string, Check<D>>();

  /**
   * 标记当前 model 是否已经删除.
   * 当某个对象从数组中移除时，该对象对应的 model 就被会标记为 _selfDeleted=true
   * */
  _selfDeleted = false;

  get values(): D {
    if (this._modelType === ModelType.rootModel) {
      return this._values;
    } else {
      return this.parent.getValue(this.name);
    }
  }

  set values(nextValues: D) {
    if (this.isDeleted) {
      console.warn(
        '[xform] 对已删除的 Model 进行赋值将被忽略。请不要对已删除的 Model/Field 进行操作。'
      );
      return;
    }

    if (this._modelType === ModelType.rootModel) {
      if (nextValues == null) {
        console.warn('[xform] FormModel 根节点的 values 不能设置为 null/undefined');
      }
      this._values = nextValues;
    } else {
      this.parent.setValue(this.name, nextValues);
    }
  }

  get path(): string[] {
    if (this._modelType == ModelType.rootModel) {
      return EMPTY_PATH;
    } else {
      return [...this.parent.path, this.name];
    }
  }

  constructor(initValues?: D, options = ROOT_MODEL_CREATE_OPTIONS) {
    if (options?.modelType === ModelType.subModel) {
      this._modelType = ModelType.subModel;
      this.parent = options.parent;
      this.root = this.parent.root;
      this.name = options.name;
      this.id = this.root._modelIdGenerator.getNextId();
    } else {
      this._modelType = ModelType.rootModel;
      this.parent = this;
      this.root = this;
      this.name = '';

      this._modelIdGenerator = new IdGenerator('Model');
      this._fieldIdGenerator = new IdGenerator('Field');
      this.id = this._modelIdGenerator.getNextId();

      // root model 才会使用 this._values
      this._values = composeValue(initValues, {} as any);
      if (this._values == null) {
        console.warn('[xform] FormModel 根节点的初始 values 不能为 null');
      }
    }

    makeObservable(
      this,
      {
        // root model 才会使用 this._values
        _values: this._modelType === ModelType.rootModel ? observable : false,
        values: computed,
        state: observable,
        setValue: action,
        // 注意 name 是可以变化的；在数组元素调换位置的情况下 name 会进行变更
        name: observable.ref,
        path: computed,
        _selfDeleted: observable.ref,
        isDeleted: computed,
        _markDeleted: action,
      },
      { name: `${this.id}(${this.name})` }
    );
  }

  getValue<N extends XName<D>>(name: N, defaultValue?: ResolveXName<D, N>): ResolveXName<D, N> {
    return observableGetIn(this.values, String(name), defaultValue);
  }

  setValue<N extends XName<D>>(name: N, value: ResolveXName<D, N>) {
    if (this.isDeleted) {
      console.warn(
        '[xform] 对已删除的 Model 进行赋值将被忽略。请不要对已删除的 Model/Field 进行操作。'
      );
      return;
    }

    if (this._modelType === ModelType.subModel && this.values == null) {
      this._updateValueShape(keyToValueShape(splitToPath(String(name))[0]));
      this.values = (this._valueShape === 'array' ? [] : {}) as D;
    }
    observableSetIn(this.values, name as string, value);
  }

  getSubModel<N extends XName<D>>(name: N | string[]): FormModel<ResolveXName<D, N>> {
    const path = Array.isArray(name) ? name : splitToPath(name);
    let mod: FormModel = this;
    for (let i = 0; i < path.length - 1; i++) {
      mod = mod._getSubModelByShortName(path[i]);
    }
    return mod._getSubModelByShortName(path[path.length - 1]);
  }

  getField<N extends XName<D>>(name: N | string[]): Field<ResolveXName<D, N>> {
    const path = Array.isArray(name) ? name : splitToPath(name);

    if (path.length > 1) {
      const lastName = path[path.length - 1];
      const subModel = this.getSubModel(path.slice(0, -1));
      return subModel.getField([lastName]) as any;
    }

    const shortName = path[0];
    this._updateValueShape(keyToValueShape(shortName));

    let field: Field<any> = this._fieldMap.get(shortName);
    if (field == null) {
      field = new Field({
        fieldType: FieldType.normal,
        parent: this,
        name: shortName,
      });
      this._fieldMap.set(shortName, field);
    }
    return field;
  }

  getTupleField<NS extends (keyof D & string)[]>(
    ...tupleParts: NS
  ): Field<{
    [Index in keyof NS]: NS[Index] extends keyof D ? D[NS[Index]] : never;
  }> {
    // 只有 valueShape 是 object 的 FormModel 才能获取 tupleField
    this._updateValueShape('object');
    const name = `tuple(${tupleParts.join(',')})`;

    let field: Field<any> = this._fieldMap.get(name);
    if (field == null) {
      field = new Field({
        fieldType: FieldType.tuple,
        parent: this,
        name,
        tupleParts,
      });
      this._fieldMap.set(name, field);
    }
    return field;
  }

  _asField() {
    if (this._modelType === ModelType.rootModel) {
      throw new Error('[xform] 根节点下不支持使用 name=&。根节点的数据结构只能为普通对象。');
    }
    return this.parent.getField(this.name) as Field<D>;
  }

  _updateValueShape(valueShape: 'array' | 'object') {
    if (this._valueShape === 'auto') {
      this._valueShape = valueShape;
      this._subModels = valueShape === 'object' ? {} : ([] as any);
    } else {
      invariant(
        this._valueShape === valueShape,
        '[xform] FormModel 的结构需要在使用过程中保持一致，一个数据索引对应的结构不能从数组变为对象，也不能从对象变为数组'
      );
    }
  }

  /** 递归前序遍历该 model 下所有的 model 对象（包含 model 本身） */
  iterateModels(iteratee: (mod: FormModel) => void) {
    iteratee(this);
    if (this._subModels != null) {
      for (const subModel of Object.values(this._subModels)) {
        subModel.iterateModels(iteratee);
      }
    }
  }

  /** 递归遍历该 model 下（包括 model 本身）所有存在的 field 对象（包括 normal field 和 tuple field，也包括所有 fork） */
  iterateFields(iteratee: (field: Field) => void) {
    this.iterateModels((model) => {
      model._fieldMap.forEach((field) => {
        field._forkMap.forEach(iteratee);
      });
    });
  }

  /** 递归遍历该 model 下（包括 model 本身）所有存在的 check 对象） */
  iterateChecks(iteratee: (check: Check) => void) {
    this.iterateModels((model) => {
      model._checkMap.forEach(iteratee);
    });
  }

  _getSubModelByShortName(name: string): FormModel<any> {
    this._updateValueShape(keyToValueShape(name));

    let subModel = this._subModels[name];

    if (subModel == null) {
      subModel = new FormModel(null, {
        modelType: ModelType.subModel,
        parent: this,
        name,
      });
      (this._subModels as any)[name] = subModel;
    }

    return subModel;
  }

  getCheck(name: string) {
    let check = this._checkMap.get(name);
    if (check == null) {
      check = new Check(this, name);
      this._checkMap.set(name, check);
    }
    return check;
  }

  /** 判断当前 model 是否已经删除 */
  get isDeleted(): boolean {
    if (this._selfDeleted) {
      return true;
    }
    // deleted 具有继承性，删除父节点会自动删除子节点
    return this._modelType === ModelType.subModel && this.parent.isDeleted;
  }

  _markDeleted() {
    invariant(this._modelType === ModelType.subModel, '只有 subModels 才允许被删除.');
    this.name = '(deleted)';
    this._selfDeleted = true;
  }
}

export class Check<D = unknown> {
  /** Check 是否在视图中被渲染 */
  isMounted = false;

  /** Check 配置的最新缓存（注意不要修改该值）*/
  config?: CheckConfig<D> = null;

  readonly parent: FormModel<D>;
  readonly name: string;

  error: any = undefined;
  cancelValidation: () => void = null;
  validating: boolean = false;

  get path() {
    return this.parent.path.concat([this.name]);
  }

  constructor(parent: FormModel<D>, name: string) {
    this.parent = parent;
    this.name = name;

    makeObservable(this, {
      path: computed,
      validate: action,
      error: observable,
      cancelValidation: observable.ref,
      validating: observable.ref,
    });
  }

  _track(config: CheckConfig<D>) {
    if (this.isMounted) {
      console.warn(`[xform] check \`${this.path.join('.')}\` 已在视图中被加载。`);
      return;
    }

    this.config = config;
    this.isMounted = true;

    return () => {
      this.config = null;
      this.isMounted = false;
    };
  }

  async validate() {
    if (!this.isMounted) {
      return;
    }
    const { validate } = this.config;
    let cancelled = false;
    this.cancelValidation?.();
    this.validating = true;
    this.cancelValidation = action(() => {
      cancelled = true;
      this.cancelValidation = null;
      this.validating = false;
    });
    const handleValidateResult = action((error: any) => {
      if (cancelled) {
        return;
      }
      this.cancelValidation = null;
      this.validating = false;
      this.error = error;
      return error;
    });
    const model = this.parent;
    const result: any = validate(toJS(model.values), model);
    if (typeof result?.then === 'function') {
      return Promise.resolve(result).then(handleValidateResult);
    } else {
      return handleValidateResult(result);
    }
  }
}

export class Field<V = unknown> {
  static ORIGINAL = 'original';
  static getHtmlId(prefix: string, field: Field) {
    if (prefix == null || typeof prefix !== 'string') {
      // null 表示不生成 id 属性
      return undefined;
    }
    const path = field.path.join('.');
    const fork = field._forkName !== Field.ORIGINAL ? `#${field._forkName}` : '';
    return `${prefix}${path}${fork}`;
  }
  /** 字段配置的最新缓存（注意不要修改该值）*/
  config?: FieldConfig<V> = null;
  /** 字段是否在视图中被渲染 */
  isMounted = false;
  readonly parent: FormModel<any>;
  readonly name: string;
  readonly _forkName: string;
  readonly _tupleParts: string[];
  readonly id: string;
  readonly _forkMap: Map<string, Field>;
  readonly fieldType: FieldType;
  readonly _readonlyValue: any;
  state: FieldState = {};

  get value(): V {
    if (this.fieldType === FieldType.normal) {
      return this.parent.getValue(this.name) as any;
    } else if (this.fieldType === FieldType.tuple) {
      return this._tupleParts.map((part) => this.parent.getValue(part)) as any;
    } else if (this.fieldType === FieldType.readonly) {
      return this._readonlyValue;
    }
  }

  set value(value: V) {
    if (this.isDeleted) {
      console.warn(
        '[xform] 对已删除的 Field 进行赋值将被忽略。请不要对已删除的 Model/Field 进行操作。'
      );
      return;
    }
    if (this.fieldType === FieldType.normal) {
      this.parent.setValue(this.name, value);
    } else if (this.fieldType === FieldType.tuple) {
      this._tupleParts.forEach((part, index) => {
        this.parent.setValue(part, value == null ? value : value[index]);
      });
    } else if (this.fieldType === FieldType.readonly) {
      console.warn(
        '[xform] 对只读 Field 进行赋值将被忽略，请检查是否为 FormItem 设置了 props.name 或 props.field.'
      );
    }
  }

  get path() {
    return this.parent.path.concat([this.name]);
  }

  constructor(opts: FieldCreateOptions) {
    this.fieldType = opts.fieldType;
    this.parent = opts.parent;
    this.name = opts.name;
    this.id = this.parent.root._fieldIdGenerator.getNextId();
    this._forkName = opts.forkName ?? Field.ORIGINAL;
    if (opts.fieldType === FieldType.tuple) {
      this._tupleParts = opts.tupleParts;
    } else if (opts.fieldType === FieldType.readonly) {
      this._readonlyValue = opts.value;
    }
    const name = this.name;
    const forkName = this._forkName;

    makeObservable(
      this,
      {
        state: observable,
        value: computed,
        path: computed,
        validate: action,
        handleBlur: action,
        handleChange: action,
        clear: action,
        isDeleted: computed,
      },
      {
        name: `${this.id}(${name}${forkName === Field.ORIGINAL ? '' : '#' + forkName})`,
      }
    );
    if (forkName === Field.ORIGINAL) {
      this._forkMap = new Map();
    } else {
      const original = this.parent.getField(name);
      this._forkMap = original._forkMap;
    }
    this._forkMap.set(forkName, this);
  }

  _track(config: FieldConfig<V>) {
    if (this.isMounted) {
      console.warn(
        `[xform] field \`${this.path.join(
          '.'
        )}\` 已在视图中被加载，你需要 fork 该字段来进行多次加载.`
      );
      return;
    }
    this.config = config;
    this.isMounted = true;
    return () => {
      this.config = null;
      this.isMounted = false;
    };
  }

  getFork(forkName: string): Field<V> {
    if (this._forkMap.has(forkName)) {
      return this._forkMap.get(forkName) as Field<V>;
    } else {
      const common = { parent: this.parent, name: this.name, forkName };
      if (this.fieldType === FieldType.normal) {
        return new Field({ fieldType: FieldType.normal, ...common });
      } else if (this.fieldType === FieldType.tuple) {
        return new Field({
          fieldType: FieldType.tuple,
          tupleParts: this._tupleParts,
          ...common,
        });
      } else if (this.fieldType === FieldType.readonly) {
        return new Field({
          fieldType: FieldType.readonly,
          value: this._readonlyValue,
          ...common,
        });
      }
    }
  }

  async validate(trigger: FieldValidateTrigger = '*') {
    if (!this.isMounted) {
      return;
    }
    const {
      validate,
      defaultValue,
      isEmpty,
      required,
      requiredMessage = '该字段为必填项',
      validateOnMount,
      validateOnBlur,
      validateOnChange,
    } = this.config;

    const needValidate =
      trigger === '*' ||
      (validateOnBlur && trigger === 'blur') ||
      (validateOnMount && trigger === 'mount') ||
      (validateOnChange && trigger === 'change');

    if (!needValidate) {
      return;
    }

    let cancelled = false;
    this.state.cancelValidation?.();
    this.state.validating = true;
    this.state.cancelValidation = action(() => {
      cancelled = true;
      this.state.cancelValidation = null;
      this.state.validating = false;
    });

    const handleValidateResult = action((error: any) => {
      if (cancelled) {
        return;
      }
      this.state.cancelValidation = null;
      this.state.validating = false;
      this.state.error = error;
      return error;
    });

    const value = toJS(composeValue(this.value, defaultValue));
    if (required && isEmpty(value)) {
      return handleValidateResult(requiredMessage);
    }

    if (validate) {
      const result: any = validate(value, this, trigger);
      if (typeof result?.then === 'function') {
        return Promise.resolve(result).then(handleValidateResult);
      } else {
        return handleValidateResult(result);
      }
    } else {
      return handleValidateResult(null);
    }
  }

  handleFocus = () => {
    // noop 留着为后续进行功能拓展
  };

  handleBlur = () => {
    return this.validate('blur');
  };

  handleChange = (nextValue: any, ...rest: any[]) => {
    if (nextValue === undefined && this.config?.defaultValue !== undefined) {
      console.warn(
        '[xform] xform 中所有组件均为受控用法，不支持 onChange(undefined)，该调用将自动变为 onChange(null)'
      );
      nextValue = null;
    }
    this.value = nextValue;
    this.config?.afterChange?.(nextValue, ...rest);
    return this.validate('change');
  };

  get isDeleted() {
    return this.parent.isDeleted;
  }

  /** 清理字段，将清空字段的错误与值 */
  clear = () => {
    if (this.isDeleted) {
      return;
    }
    const parent = this.parent;
    // 清空错误
    this.state.cancelValidation?.();
    this.state.error = null;
    // 清空值
    if (parent.values == null) {
      return;
    }
    if (this.fieldType === FieldType.normal) {
      delete parent.values[this.name];
    } else if (this.fieldType === FieldType.tuple) {
      for (const part of this._tupleParts) {
        delete parent.values[part];
      }
    }
  };
}
