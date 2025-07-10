# Form

This is an example component.

```jsx
import { observer } from 'mobx-react-lite';
import { Form, FormItem, FormModel } from './index';
import { ValuePreview } from './valuePreview';

export default observer(() => {
  const model = new FormModel({
    name: '张三',
    introduce: '我是张三，我来自湖北',
  });
  return (
    <div>
      <div className="title">基本用法</div>
      <div className="container">
        <Form model={model} onSubmit={(values) => console.log(values)}>
          <FormItem component="input" label="姓名" name="name" required />
          <FormItem
            component="textArea"
            label="介绍"
            labelStyle={{ marginTop: -4 }}
            name="introduce"
            required
          />
          <FormItem
            defaultValue="jack"
            component="select"
            label="朋友"
            options={[
              { value: 'jack', label: 'Jack' },
              { value: 'lucy', label: 'Lucy' },
              { value: 'Yiminghe', label: 'yiminghe' },
              { value: 'disabled', label: 'Disabled', disabled: true },
            ]}
            writeDefaultValueToModel={true}
            name="friend"
            required
            componentProps={{
              style: { width: '100%' },
            }}
          />
          <FormItem
            defaultValue={['book']}
            component="select"
            label="爱好"
            options={[
              { value: 'book', label: '读书' },
              { value: 'study', label: '学习' },
              { value: 'disabled', label: 'Disabled', disabled: true },
            ]}
            writeDefaultValueToModel={true}
            name="likes"
            required
            componentProps={{
              style: { width: '100%' },
              mode: 'multiple',
            }}
          />
          <FormItem
            component="radio"
            labelStyle={{ marginTop: -4 }}
            label="性别"
            options={[
              { value: 'male', label: '男' },
              { value: 'female', label: '女' },
            ]}
            defaultValue="male"
            writeDefaultValueToModel={true}
            name="gender"
            required
          />
          <FormItem
            component="checkbox"
            defaultValue={['apple']}
            writeDefaultValueToModel={true}
            label="喜欢的水果"
            labelStyle={{ marginTop: -4 }}
            options={[
              { value: 'apple', label: '苹果' },
              { value: 'banana', label: '香蕉' },
            ]}
            name="fruits"
            required
          />
          <FormItem
            component="inputNumber"
            defaultValue={1}
            writeDefaultValueToModel={true}
            label="折扣"
            name="numbers"
            required
            componentProps={{
              min: 0,
              max: 10,
            }}
          />
          <FormItem
            component="slider"
            defaultValue={80}
            writeDefaultValueToModel={true}
            label="进度条"
            name="slider"
            required
          />
          <FormItem
            component="switch"
            defaultValue={true}
            writeDefaultValueToModel={true}
            label="开关"
            name="switch"
            required
          />
                  <ValuePreview  defaultShow={true}  />
        </Form>

      </div>
    </div>
  );
});
```
