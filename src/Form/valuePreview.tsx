import React from 'react';
import { toJS } from 'mobx';
import { Checkbox } from 'antd';
import ReactJson from 'react-json-view';
import { observer } from 'mobx-react-lite';
import { FormModel } from './model';
import { useModel } from './context/modelContext';

export interface ValuePreviewProps {
  style?: React.CSSProperties;
  defaultShow?: boolean;
  model?: FormModel;
}

export const ValuePreview = observer(
  ({ style, defaultShow, model: modelProp }: ValuePreviewProps) => {
    const ctxModel = useModel();
    const model = modelProp ?? ctxModel;
    console.log(model , '=====');
    
    const data = toJS(model.values) as object;
    const [showReactJson, setShowReactJson] = React.useState(defaultShow);

    return (
      <div style={style}>
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <Checkbox checked={showReactJson} onChange={(v) => setShowReactJson(v.target.checked)}>
            显示 JSON
          </Checkbox>
        </div>
        {showReactJson && <ReactJson name="表单状态预览" src={data} />}
      </div>
    );
  }
);
