const xml2js = require("xml2js");

const parseXML = (xmlBuffer) => {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      normalize: true,
      trim: true,
    });

    parser.parseString(xmlBuffer, (err, result) => {
      if (err) {
        reject(new Error(`Failed to parse XML: ${err.message}`));
      } else {
        resolve(result);
      }
    });
  });
};

module.exports = {
  parseXML,
};
