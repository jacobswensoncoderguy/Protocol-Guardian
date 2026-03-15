import { useReducer, useCallback } from 'react';
import {
  WizardState,
  WizardEvent,
  WizardStep,
  WizardFormData,
  INITIAL_FORM_DATA,
  STEP_ORDER,
  stepToIndex,
  indexToStep,
} from './types';

const INITIAL_STATE: WizardState = {
  step: 'IDLE',
  formData: { ...INITIAL_FORM_DATA },
  highestStep: -1,
  error: null,
};

function wizardReducer(state: WizardState, event: WizardEvent): WizardState {
  switch (event.type) {
    case 'START':
      return { ...state, step: 'STEP_1', error: null };

    case 'NEXT': {
      const currentIdx = stepToIndex(state.step);
      if (currentIdx < 0 || currentIdx >= STEP_ORDER.length - 1) return state;
      const newData = event.payload ? { ...state.formData, ...event.payload } : state.formData;
      const nextStep = indexToStep(currentIdx + 1);
      return {
        ...state,
        step: nextStep,
        formData: newData,
        highestStep: Math.max(state.highestStep, currentIdx),
        error: null,
      };
    }

    case 'BACK': {
      const currentIdx = stepToIndex(state.step);
      if (currentIdx <= 0) return state;
      return { ...state, step: indexToStep(currentIdx - 1), error: null };
    }

    case 'JUMP': {
      const targetIdx = event.stepNumber;
      if (targetIdx < 0 || targetIdx > state.highestStep) return state;
      return { ...state, step: indexToStep(targetIdx), error: null };
    }

    case 'UPDATE_FORM':
      return { ...state, formData: { ...state.formData, ...event.payload } };

    case 'SAVE': {
      if (state.step !== 'STEP_6') return state;
      return { ...state, step: 'SAVING', error: null };
    }

    case 'SAVE_SUCCESS':
      return { ...state, step: 'SAVED', highestStep: 5 };

    case 'SAVE_ERROR':
      return { ...state, step: 'ERROR', error: event.error };

    case 'RESET':
      return { ...INITIAL_STATE };

    case 'EDIT_EXISTING':
      return {
        ...state,
        step: 'STEP_6',
        formData: event.formData,
        highestStep: 5,
        error: null,
      };

    default:
      return state;
  }
}

export function useWizardMachine() {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);

  const start = useCallback(() => dispatch({ type: 'START' }), []);
  const next = useCallback((payload?: Partial<WizardFormData>) => dispatch({ type: 'NEXT', payload }), []);
  const back = useCallback(() => dispatch({ type: 'BACK' }), []);
  const jump = useCallback((stepNumber: number) => dispatch({ type: 'JUMP', stepNumber }), []);
  const updateForm = useCallback((payload: Partial<WizardFormData>) => dispatch({ type: 'UPDATE_FORM', payload }), []);
  const save = useCallback(() => dispatch({ type: 'SAVE' }), []);
  const saveSuccess = useCallback(() => dispatch({ type: 'SAVE_SUCCESS' }), []);
  const saveError = useCallback((error: string) => dispatch({ type: 'SAVE_ERROR', error }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const editExisting = useCallback((formData: WizardFormData) => dispatch({ type: 'EDIT_EXISTING', formData }), []);

  return {
    state,
    start,
    next,
    back,
    jump,
    updateForm,
    save,
    saveSuccess,
    saveError,
    reset,
    editExisting,
  };
}
