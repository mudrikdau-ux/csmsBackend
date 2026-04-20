const bcrypt = require('bcryptjs');

const password = 'Mudy@2005';

const hashPassword = async () => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);

        console.log('Hashed Password:\n', hashed);
    } catch (error) {
        console.error(error);
    }
};

hashPassword();