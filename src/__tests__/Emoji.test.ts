import Emoji from '../models/Emoji';

jest.mock('isomorphic-fetch')

test('Emoji from http url', () => {
    fetch.__setResponse = 
    Emoji.fromUrl(https)
})
