import { Input, Select, Radio, Checkbox, InputNumber, Slider, Switch } from 'antd';
import { isEmptyValue, withValueChangeHandler } from './common-utils';
import { FormItemCreationOptions } from '../form/type';

export const ALL_COMPONENTS: FormItemCreationOptions[] = [
  {
    name: 'input',
    component: withValueChangeHandler(Input),
    defaultValue: '',
    isEmpty: isEmptyValue,
    hasIntrinsicWidth: false,
  },
  {
    name: 'textArea',
    component: withValueChangeHandler(Input.TextArea),
    defaultValue: '',
    isEmpty: isEmptyValue,
    hasIntrinsicWidth: false,
  },
  {
    name: 'select',
    component: Select,
    defaultValue: '',
    isEmpty: isEmptyValue,
    hasIntrinsicWidth: false,
  },
  {
    name: 'radio',
    component: withValueChangeHandler(Radio.Group),
    defaultValue: '',
    isEmpty: isEmptyValue,
    hasIntrinsicWidth: false,
  },
  {
    name: 'checkbox',
    component: Checkbox.Group,
    defaultValue: '',
    isEmpty: isEmptyValue,
    hasIntrinsicWidth: false,
  },
  {
    name: 'inputNumber',
    component: InputNumber,
    defaultValue: '',
    isEmpty: isEmptyValue,
    hasIntrinsicWidth: false,
  },
  {
    name: 'slider',
    component: Slider,
    defaultValue: '',
    isEmpty: isEmptyValue,
    hasIntrinsicWidth: false,
  },
  {
    name: 'switch',
    component: Switch,
    defaultValue: false,
    isEmpty: isEmptyValue,
    hasIntrinsicWidth: false,
  },
];
