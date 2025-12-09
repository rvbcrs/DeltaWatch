import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

const DialogContext = createContext(null);

export const useDialog = () => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
};

export const DialogProvider = ({ children }) => {
    const [dialog, setDialog] = useState(null);
    const resolver = useRef(null);

    const confirm = useCallback((options) => {
        setDialog(options);
        return new Promise((resolve) => {
            resolver.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        resolver.current && resolver.current(true);
        setDialog(null);
    };

    const handleCancel = () => {
        resolver.current && resolver.current(false);
        setDialog(null);
    };

    return (
        <DialogContext.Provider value={{ confirm }}>
            {children}
            {dialog && (
                <ConfirmDialog 
                    {...dialog} 
                    onConfirm={handleConfirm} 
                    onCancel={handleCancel} 
                />
            )}
        </DialogContext.Provider>
    );
};
