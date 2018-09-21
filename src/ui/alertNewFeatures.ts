import { generatedPrompts } from '../prompts';

export default (features: string[]) => {
    const prompt: string = generatedPrompts.extensionUpdated(features)
    alert(prompt);
}
