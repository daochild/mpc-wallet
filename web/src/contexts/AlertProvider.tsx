import React, {createContext, useReducer} from "react";

export enum classAlert {
    info = 'Info',
    error = 'Error',
    success = 'Success',
}

interface AlertState {
    text: string,
    cls: classAlert
    show: boolean
}

const initialState: AlertState = {
    text: '',
    cls: classAlert.info,
    show: false
}

interface AlertActionProps {
    text: string,
    cls: classAlert
}

export const alertReducer = (state: AlertState, action: any) => {
    switch (action.type) {
        case 'hide' :
            return initialState;
        case 'show' :
            return action.payload;
        default:
            return state;
    }
};

export const AlertContext = createContext<{
    alert: AlertState,
    hideAlert: () => void,
    showAlert: ({text, cls}: AlertActionProps) => void,
}>({
    alert: initialState,
    hideAlert: () => {},
    showAlert: ({text, cls}) => {},
});

export default function AlertProvider({children}: any) {
    const [alert, dispatch] = useReducer(alertReducer, initialState);
    const hideAlert = () => {
        dispatch({type: "hide"})
    };
    const showAlert = ({text, cls}: AlertActionProps) => {
        dispatch({type: "show", payload: {cls, text, show: true}});
    };

    return (
        <AlertContext.Provider
            value={{
                alert,
                hideAlert,
                showAlert
            }}
        >
            {children}
        </AlertContext.Provider>
    )

}