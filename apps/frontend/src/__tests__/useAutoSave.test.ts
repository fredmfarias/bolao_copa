import { renderHook } from '@testing-library/react';
import { useAutoSave } from '@/hooks/useAutoSave';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('não chama onSave antes do delay', () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  renderHook(() => useAutoSave('dados', onSave, 1500));

  jest.advanceTimersByTime(1000);
  expect(onSave).not.toHaveBeenCalled();
});

it('chama onSave com os dados após o delay', () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  renderHook(() => useAutoSave('dados', onSave, 1500));

  jest.advanceTimersByTime(1500);
  expect(onSave).toHaveBeenCalledWith('dados');
  expect(onSave).toHaveBeenCalledTimes(1);
});

it('reseta o timer quando os dados mudam antes do delay', () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const { rerender } = renderHook(
    ({ data }) => useAutoSave(data, onSave, 1500),
    { initialProps: { data: 'v1' } }
  );

  jest.advanceTimersByTime(1000);
  rerender({ data: 'v2' });
  jest.advanceTimersByTime(1000);
  expect(onSave).not.toHaveBeenCalled();

  jest.advanceTimersByTime(500);
  expect(onSave).toHaveBeenCalledWith('v2');
  expect(onSave).toHaveBeenCalledTimes(1);
});
