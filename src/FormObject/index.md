# FormObject

This is an example component.

```jsx
import { observer } from 'mobx-react-lite';
import { Form, FormItem, FormModel ,arrayHelpers, AppendButton} from '../form';
import { ValuePreview } from '../form/valuePreview';
import { Button } from 'antd';

export default observer(() => {
     const model = new FormModel({
    list: {
      name: '李四',
      phone: '188-8888-8888',
      address: {
        prov: '浙江省',
        city: '杭州市',
      },
    },
    list1: {
      name: '张三',
      phone: '188-8888-8888',
      address: {
        prov: '浙江省',
        city: '杭州市',
      },
    },
  });
  return (
    <div style={{ maxWidth: 500 }}>
      <Form model={model} layout={{ inlineError: true }} onSubmit={(values) => console.log(values)}>
        <Form.Object name="list">
          <div style={{ border: '1px solid #ccc', padding: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div> 李四</div>
            </div>
            <FormItem component={'input'} label="姓名" name="name" required />
            <FormItem component={'input'} label="电话" name="phone" required />
            <Form.Object name="address">
              <FormItem component={'input'} label="省份" name="prov" required />
              <FormItem component={'input'} label="城市" name="city" required />
            </Form.Object>
          </div>
        </Form.Object>
        <Form.Object name="list1">
          <div style={{ border: '1px solid #ccc', padding: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div> 张三</div>
            </div>
            <FormItem component="input" label="姓名" name="name" required />
            <FormItem component="input" label="电话" name="phone" required />
            <FormItem component="input" label="省份" name="address.prov" required />
            <FormItem component="input" label="城市" name="address.city" required />
          </div>
        </Form.Object>
        <ValuePreview defaultShow={true} />
      </Form>
    </div>
  );
});
```
