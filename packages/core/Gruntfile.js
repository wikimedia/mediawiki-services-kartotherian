/* eslint-env node */
module.exports = function Gruntfile(grunt) {
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-eslint');

  grunt.initConfig({
    eslint: {
      code: {
        options: {
          configFile: '.eslintrc.js'
        },
        src: [
          'lib/*.js',
        ],
      },
    },
  });

  grunt.registerTask('lint', 'eslint');
  grunt.registerTask('test', 'lint');
  grunt.registerTask('default', 'test');
};
