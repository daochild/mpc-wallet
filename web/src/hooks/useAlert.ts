import { useContext } from "react";
import { AlertContext } from "../contexts/AlertProvider";

export function useAlert() {
    const {alert, showAlert, hideAlert} = useContext(AlertContext)

    return {
        alert,
        showAlert,
        hideAlert
    }
}