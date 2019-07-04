/* eslint-env node */
module.exports = function Gruntfile(grunt) {
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-stylelint');

  grunt.initConfig({
    eslint: {
      lib: {
        options: {
          configFile: '.eslintrc.js',
        },
        src: [
          'lib/*.js',
        ],
      },
      static: {
        options: {
          configFile: 'static/.eslintrc.js',
        },
        src: [
          'static/main.js',
        ],
      },
    },
    // Lint – Styling
    stylelint: {
      options: {
        syntax: 'less',
      },
      all: [
        'static/**/*.css',
        '!static/lib/**',
      ],
    },
  });

  grunt.registerTask('lint', ['eslint', 'stylelint']);
  grunt.registerTask('test', 'lint');
  grunt.registerTask('default', 'test');
};
