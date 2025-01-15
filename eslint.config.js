import eslintConfigCityssm, { cspellWords, tseslint } from 'eslint-config-cityssm';
const config = tseslint.config(...eslintConfigCityssm, {
    rules: {
        '@cspell/spellchecker': [
            'warn',
            {
                cspell: {
                    words: [
                        ...cspellWords,
                        'fasterwebcloud',
                        'releasenotes',
                        'reportviewer'
                    ]
                }
            }
        ]
    }
});
export default config;
