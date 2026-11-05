// Check the main signed-in page for undefined variables that a Vite build
// would otherwise accept, leaving users with a white screen at runtime.
export default [{
  files:['src/App.jsx'],
  languageOptions:{
    ecmaVersion:'latest',
    sourceType:'module',
    parserOptions:{ecmaFeatures:{jsx:true}},
    globals:Object.fromEntries([
      'window','document','fetch','crypto','setTimeout','clearTimeout',
      'setInterval','clearInterval','URL','URLSearchParams','navigator',
      'console','performance','location',
    ].map(name=>[name,'readonly'])),
  },
  rules:{'no-undef':'error'},
}];
