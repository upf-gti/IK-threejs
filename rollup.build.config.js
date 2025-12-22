import terser from '@rollup/plugin-terser';

export default [
    {
        input: "rollup.build.index.js",
        output: [
            {
                file: 'build/ikthree.module.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra @evallsg'
            },
            {
                file: 'build/ikthree.module.min.js',
                format: 'esm',
                banner: '// This is a generated file. Do not edit. \n // Developers: @japopra @evallsg',
                plugins: [terser()]
            }
        ]
    }
];