export function isEmptyValue(value: any) {
  return value == null || value === '';
}

/**
 * antd中某些组件的onChange并不是直接返回value,而是e.target.value
 */
export const withValueChangeHandler = <T extends { onChange?: (...args: any[]) => void }>(
  Component: React.ComponentType<T>
) => {
  return (props: Omit<T, 'onChange'> & { onChange?: (value: any) => void }) => {
    const handleChange = (e: React.ChangeEvent<{ value: any }>) => {
      props.onChange?.(e.target.value);
    };
    // 使用类型断言处理组件props类型
    return <Component {...(props as T)} onChange={handleChange} />;
  };
};
