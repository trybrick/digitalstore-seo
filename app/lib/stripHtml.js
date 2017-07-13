const minify = require( 'html-minifier' ).minify;

const COMPRESSION_HEADER = 'X-Prerender-Compression-Ratio';
const options = {
  minifyCSS: true,
  minifyJS: true,
  removeComments: true,
  collapseWhitespace: true,
  preserveLineBreaks: true,
  removeEmptyAttributes: true,
  removeEmptyElements: true
};

module.exports = {
  afterPhantomRequest( req, res, next ) {
    if ( !req.prerender.documentHTML ) {
      return next();
    }

    var msg = req.prerender.documentHTML.toString();
    const sizeBefore = msg.length;
    msg = msg.replace( /<!--begin:seoxclude\-head[+\s\S]+<\/head>/gi, '</head>' );
    msg = msg.replace( /<!--begin:seoxclude\-body[+\s\S]+<\/body>/gi, '</body>' );
    msg = msg.replace( /<!--begin:analytics[+\s\S]+<!--end:analytics-->/gi, '' );
    msg = msg.replace( /<!--begin:seoxclude1[+\s\S]+<!--end:seoxclude1-->/gi, '' );
    msg = msg.replace( /<!--begin:seoxclude2[+\s\S]+<!--end:seoxclude2-->/gi, '' );
    msg = msg.replace( /<!--begin:seoxclude3[+\s\S]+<!--end:seoxclude3-->/gi, '' );
    msg = msg.replace( /<!--begin:seoxclude4[+\s\S]+<!--end:seoxclude4-->/gi, '' );
    msg = msg.replace( /<!--begin:seoxclude5[+\s\S]+<!--end:seoxclude5-->/gi, '' );
    msg = minify( msg, options );
    req.prerender.documentHTML = msg;
    const sizeAfter = req.prerender.documentHTML.toString().length;

    res.setHeader( COMPRESSION_HEADER, ( ( sizeBefore - sizeAfter ) / sizeBefore ).toFixed( 4 ) );
    next();
  }
};
