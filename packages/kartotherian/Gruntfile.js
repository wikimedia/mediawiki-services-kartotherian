/* eslint-env node */
module.exports = function Gruntfile(grunt) {
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.initConfig({
    eslint: {
      code: {
        options: {
          configFile: '.eslintrc.js',
        },
        src: [
          'lib/*.js',
          'routes/*.js',
          'scripts/*.js',
          'app.js',
          'server.js',
        ],
      },
      test: {
        options: {
          configFile: 'test/.eslintrc.js',
        },
        src: [
          'test/**/*.js',
        ],
      },
    },
    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
        },
        src: ['test/**/*.js'],
      },
    },
  });

  grunt.registerTask('lint', 'eslint');
  grunt.registerTask('test', ['lint', 'mochaTest']);
  grunt.registerTask('default', 'test');
};
