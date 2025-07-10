import React, { createContext, useContext } from 'react';
import { FormEnvContextType } from '../type';

const FormEnvContext = createContext<FormEnvContextType>({
  isPreview: false,
  validateOnMount: false,
  validateOnBlur: true,
  validateOnChange: true,
  writeDefaultValueToModel: false,
  autoUnmount: false,
});
FormEnvContext.displayName = 'FormEnvContext';
export const useFormEnv = () => useContext(FormEnvContext);


export function FormEnvProvider({
  children,
  ...override
}: FormEnvContextType & { children: React.ReactNode }) {
  const parent = useFormEnv();
  return (
    <FormEnvContext.Provider value={{ ...parent, ...override }}>{children}</FormEnvContext.Provider>
  );
}
