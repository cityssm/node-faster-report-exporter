import eslintConstants from '@cityssm/faster-constants/other/eslint'
import eslintConfigCityssm, {
  type Config,
  cspellWords,
  tseslint
} from 'eslint-config-cityssm'

const config = tseslint.config(...eslintConfigCityssm, {
  rules: {
    '@cspell/spellchecker': [
      'warn',
      {
        cspell: {
          words: [
            ...cspellWords,
            ...eslintConstants.cspellWords,
            'releasenotes',
            'reportviewer'
          ]
        }
      }
    ]
  }
}) as Config

export default config
