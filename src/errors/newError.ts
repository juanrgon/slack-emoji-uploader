import help from './help';

const newError = (name: string, message: string) => {
    return {
        name,
        message,
        help: help[name] || null,
    }
};

export default newError;
