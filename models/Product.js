const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['Regular Fan Card', 'Premium Fan Card', 'Gold Fan Card', 'Diamond Fan Card']
  },
  description: String,
  priceUSD: {
    type: Number,
    required: true
  },
  priceBTC: {
    type: Number,
    required: true
  },
  priceETH: {
    type: Number,
    required: true
  },
  image: String,
  benefits: [String],
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);
