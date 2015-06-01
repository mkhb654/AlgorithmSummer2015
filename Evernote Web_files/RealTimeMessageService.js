define('exponential-counter',[], function() {
  /**
   * Create an exponential counter with an initial value, an initial step and
   * optionally a maximum value. If a maximum value is provided, the counter
   * will not exceed that value. Instantiate a counter using new, ex: 
   * 
   * var counter = new ExponentialCounter(10, 1, 1000);
   * 
   * Returns an object with the following properties and methods defined: 
   * value: the current value of the counter 
   * increment(): increment the value of the counter
   * reset(): reset the counter to its original state
   */
  var ExponentialCounter = function(initialValue, step, maxValue) {
    this.initialValue = initialValue;
    this.value = initialValue;
    this.step = step;
    this.exponent = 0;
    this.maxValue = maxValue;
    return this;
  };

  ExponentialCounter.prototype = {
    increment : function() {
      if (!this.maxValue || this.value < this.maxValue) {
        this.value = this.initialValue + this.step
            * Math.pow(2, this.exponent++);
      }
      if (this.maxValue && this.value > this.maxValue) {
        this.value = this.maxValue;
      }
      return this;
    },
    reset : function() {
      this.value = this.initialValue;
      this.exponent = 0;
    }
  };
  return ExponentialCounter;
});

/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/*
 Description: 'JavaScript bindings for the Apache Thrift RPC system',
 License: 'http://www.apache.org/licenses/LICENSE-2.0',
 Homepage: 'http://thrift.apache.org',
 BugReports: 'https://issues.apache.org/jira/browse/THRIFT',
 Maintainer: 'dev@thrift.apache.org',
 */

define('thrift',['require'],function (require) {
    'use strict'

    var Thrift = {
        Version: '0.9.0',

        Type: {
            STOP : 0,
            VOID : 1,
            BOOL : 2,
            BYTE : 3,
            I08 : 3,
            DOUBLE : 4,
            I16 : 6,
            I32 : 8,
            I64 : 10,
            STRING : 11,
            UTF7 : 11,
            STRUCT : 12,
            EXCEPTION: 12,
            MAP : 13,
            SET : 14,
            LIST : 15,
            UTF8 : 16,
            UTF16 : 17,
            BINARY : 18
        },

        MessageType: {
            CALL : 1,
            REPLY : 2,
            EXCEPTION : 3
        },

        objectLength: function(obj) {
            var length = 0;
            for (var k in obj) {
                if (obj.hasOwnProperty(k)) {
                    length++;
                }
            }

            return length;
        },

        inherits: function(constructor, superConstructor) {
            //Prototypal Inheritance http://javascript.crockford.com/prototypal.html
            function F() {}
            F.prototype = superConstructor.prototype;
            constructor.prototype = new F();
        }
    };

    // Check two Thrift.Type values for equality
    // Used to support backwards compatibility for BINARY as STRING
    Thrift.equals = function (t1, t2) {
        return t1 == t2 ||
            (t1 == Thrift.Type.BINARY && t2 == Thrift.Type.STRING) ||
            (t1 == Thrift.Type.STRING && t2 == Thrift.Type.BINARY);
    };

    // Represent binary types as strings when serialized
    // Used to support backwards compatibility for BINARY as STRING
    Thrift.serializedType = function (t) {
        return (t == Thrift.Type.BINARY) ? Thrift.Type.STRING : t;
    };

    // defaults taken from underscore.js
    Thrift.defaults = function (target) {
        Array.prototype.slice.call(arguments, 1).forEach(function(source) {
          if (source) {
            for (var prop in source) {
              if (target[prop] === void 0) target[prop] = source[prop];
            }
          }
        });
        return target;
    };

    // extend taken from underscore.js
    Thrift.extend = function (target) {
        Array.prototype.slice.call(arguments, 1).forEach(function(source) {
          if (source) {
            for (var prop in source) {
              target[prop] = source[prop];
            }
          }
        });
        return target;
    };

    //
    // Method
    //
    Thrift.Method = function (config) {
        this.alias = config.alias;
        this.args = config.args;
        this.result = config.result;
    };

    Thrift.Method.define = function (config) {
        return new Thrift.Method(config);
    };

    Thrift.Method.noop = function () {
        // do nothing
    };

    Thrift.Method.sendException = function (output, seqid, structOrErr, structdef) {
        var config;

        if (!structdef) {
            if (structOrErr instanceof Thrift.TApplicationException) {
                structdef = Thrift.TApplicationException;
            } else if (structOrErr instanceof Thrift.TException) {
                structdef = Thrift.TException;
            } else {
                structdef = Thrift.TApplicationException;
                config = {};
                if (structOrErr) {
                    if (structOrErr.message) config.message = structOrErr.message + '';
                    if (structOrErr.code != null && Number.isFinite(config.code)) config.code = structOrErr.code;
                }
                structOrErr = new Thrift.TApplicationException(config);
            }
        }

        output.writeMessageBegin('', Thrift.MessageType.EXCEPTION, seqid);
        structdef.write(output, structOrErr);
        output.writeMessageEnd();
        output.flush();
    };

    Thrift.Method.prototype.sendRequest = function (output, seqid, struct, callback) {
        output.writeMessageBegin(this.alias, Thrift.MessageType.CALL, seqid);
        this.args.write(output, struct);
        output.writeMessageEnd();
        output.flush(function (err, response) {
            if (err) callback(err);
            else this.processResponse(response, callback);
        }.bind(this));
    };

    Thrift.Method.prototype.sendResponse = function (output, seqid, struct) {
        output.writeMessageBegin(this.alias, Thrift.MessageType.REPLY, seqid);
        this.result.write(output, struct);
        output.writeMessageEnd();
        output.flush();
    };

    Thrift.Method.prototype.processResponse = function (response, callback) {
        var header;
        var result;
        var err;
        var index;

        callback = callback || Thrift.Method.noop;

        var header = response.readMessageBegin();
        if (header.mtype == Thrift.MessageType.EXCEPTION) {
            err = Thrift.TApplicationException.read(response);
            response.readMessageEnd();
            callback(err);
            return;
        }

        if (header.mtype != Thrift.MessageType.REPLY) {
            err = Error('Client expects REPLY but received unsupported message type: ' + header.mtype);
            callback(err);
            return;
        }

        if (this.alias != header.fname) {
            err = Error('Unrecognized method name. Expected [' + me.alias + '] Received [' + header.fname + ']');
            callback(err);
            return;
        }

        result = this.result.read(response);
        response.readMessageEnd();

        // Exceptions are in fields 
        for (index in this.result.fields) {
            if (index != 0 && result[this.result.fields[index].alias]) {
                err = result[this.result.fields[index].alias];
                callback(err);
                return;
            }
        }

        callback(null, result.returnValue);
    };


    //
    // List
    //
    Thrift.List = {};

    Thrift.List.define = function (name, type, def) {
        var ThriftList = function () {
            return [];
        };

        // Name param is optional to allow anonymous lists
        if (typeof name != 'string') {
            def = type;
            type = name;
            name = 'anonymous';
        }

        ThriftList.alias = name;
        ThriftList.type = type;
        ThriftList.def = def;
        ThriftList.read = Thrift.List.read.bind(null, ThriftList);
        ThriftList.write = Thrift.List.write.bind(null, ThriftList);

        return ThriftList;
    };

    Thrift.List.read = function (listdef, input) {
        var list = new listdef();
        var header = input.readListBegin();
        Thrift.List.readEntries(listdef, list, input, header.size);
        input.readListEnd();
        return list;
    };

    Thrift.List.readEntries = function (listdef, list, input, size) {
        var i;
        for (i = 0; i < size; i++) {
            if (listdef.def != null) {
                list.push(listdef.def.read(input));
            } else {
                list.push(input.readType(listdef.type));
            }
        }
    };

    Thrift.List.write = function (listdef, output, list) {
        var val;
        var index;
        var size = list.length;

        output.writeListBegin(listdef.type, size);
        for (index = 0; index < size; index++) {
            val = list[index];
            if (listdef.def) {
                listdef.def.write(output, val);
            } else {
                output.writeType(listdef.type, val);
            }
        }
        output.writeListEnd();
    };

    //
    // Set
    //
    Thrift.Set = {};

    Thrift.Set.define = function (name, type, def) {
        var ThriftSet = function () {
            return [];
        };

        // Name param is optional to allow anonymous sets
        if (typeof name != 'string') {
            def = type;
            type = name;
            name = 'anonymous';
        }

        ThriftSet.alias = name;
        ThriftSet.type = type;
        ThriftSet.def = def;
        ThriftSet.read = Thrift.Set.read.bind(null, ThriftSet);
        ThriftSet.write = Thrift.Set.write.bind(null, ThriftSet);

        return ThriftSet;
    };

    Thrift.Set.read = function (setdef, input) {
        var set = new setdef();
        var header = input.readSetBegin();
        Thrift.Set.readEntries(setdef, set, input, header.size);
        input.readSetEnd();
        return set;
    };

    Thrift.Set.readEntries = function (setdef, set, input, size) {
        var i;
        for (i = 0; i < size; i++) {
            if (setdef.def != null) {
                set.push(setdef.def.read(input));
            } else {
                set.push(input.readType(setdef.type));
            }
        }
    };

    Thrift.Set.write = function (setdef, output, set) {
        var val;
        var index;
        var size = set.length;

        output.writeSetBegin(setdef.type, size);
        for (index = 0; index < size; index++) {
            val = set[index];
            if (setdef.def) {
                setdef.def.write(output, val);
            } else {
                output.writeType(setdef.type, val);
            }
        }
        output.writeSetEnd();
    };

    //
    // Map
    //
    Thrift.Map = {};

    Thrift.Map.define = function (name, ktype, vtype, vdef) {
        var ThriftMap = function () {
            return {};
        };

        // Name param is optional to allow anonymous maps
        if (typeof name != 'string') {
            vdef = vtype;
            vtype = ktype;
            ktype = name;
            name = 'anonymous';
        }

        ThriftMap.alias = name;
        ThriftMap.ktype = ktype;
        ThriftMap.vtype = vtype;
        ThriftMap.vdef = vdef;
        ThriftMap.read = Thrift.Map.read.bind(null, ThriftMap);
        ThriftMap.write = Thrift.Map.write.bind(null, ThriftMap);

        return ThriftMap;
    };

    Thrift.Map.read = function (mapdef, input) {
        var map = new mapdef();
        var header = input.readMapBegin();
        Thrift.Map.readEntries(mapdef, map, input, header.size);
        input.readMapEnd();
        return map;
    };

    Thrift.Map.readEntries = function (mapdef, map, input, size) {
        var i;
        var key;
        for (i = 0; i < size; i++) {
            key = input.readType(mapdef.ktype);
            if (mapdef.vdef != null) {
                map[key] = mapdef.vdef.read(input);
            } else {
                map[key] = input.readType(mapdef.vtype);
            }
        }
    };

    Thrift.Map.write = function (mapdef, output, map) {
        var keys = Object.keys(map);
        var key;
        var value;
        var index;
        var size = keys.length;

        output.writeMapBegin(mapdef.ktype, mapdef.vtype, size);
        for (index = 0; index < size; index++) {
            key = keys[index];
            output.writeType(mapdef.ktype, key);
            value = map[key];
            if (mapdef.vdef) {
                mapdef.vdef.write(output, value);
            } else {
                output.writeType(mapdef.vtype, value);
            }
        }
        output.writeMapEnd();
    };

    //
    // Struct
    //
    Thrift.Struct = {};

    Thrift.Struct.define = function (name, fields) {
        var defaultValues = {};
        var fid;
        var field;

        fields = fields || {};

        for (fid in fields) {
            field = fields[fid];
            defaultValues[field.alias] = field.defaultValue || null;
        }

        var ThriftStruct = function (args) {
          args = typeof args === 'object' ? args : {};
            return Thrift.defaults(args, defaultValues);
        };

        ThriftStruct.alias = name;
        ThriftStruct.fields = fields;
        ThriftStruct.defaultValues = defaultValues;
        ThriftStruct.read = Thrift.Struct.read.bind(null, ThriftStruct);
        ThriftStruct.write = Thrift.Struct.write.bind(null, ThriftStruct);
        ThriftStruct.values = Thrift.Struct.values.bind(null, ThriftStruct);
        ThriftStruct.setByDef = Thrift.Struct.setByDef.bind(null, ThriftStruct);

        return ThriftStruct;
    };

    Thrift.Struct.setByDef = function (structdef, struct, value) {
        var fid;
        var fields = structdef.fields;
        var field;
        var foundMatch = false;

        for (fid in fields) {
            field = fields[fid];
            if (field.def && value instanceof field.def) {
                struct[field.alias] = value;
                foundMatch = true;
                break;
            }
        }

        return foundMatch;
    };

    Thrift.Struct.values = function (structdef, struct) {
        var fields = structdef.fields;
        var keys = Object.keys(structdef.fields);
        var result = new Array(keys.length);
        var fid;
        var index;
        var i;

        for (i = 0; i < keys.length; i++) {
            fid = keys[i];
            index = fields[fid].index;
            if (index != null) result[index] = struct[fields[fid].alias];
            else result[i] = struct[fields[fid].alias];
        }

        return result;
    };

    Thrift.Struct.read = function (structdef, input) {
        var struct = new structdef();
        input.readStructBegin();
        Thrift.Struct.readFields(structdef, input, struct);
        input.readStructEnd();
        return struct;
    };

    Thrift.Struct.readFields = function (structdef, input, struct) {
        var header;
        var field;

        while (true) {
            header = input.readFieldBegin();
            
            if (header.ftype == Thrift.Type.STOP) return;
            
            field = structdef.fields[header.fid];
            if (field) {
                if (Thrift.equals(header.ftype, field.type)) {
                    if (field.def) {
                        struct[field.alias] = field.def.read(input);
                    } else {
                        struct[field.alias] = input.readType(field.type);
                    }
                } else {
                    input.skip(header.ftype);
                }
            } else {
                input.skip(header.ftype);
            }

            input.readFieldEnd();
        }
    };

    Thrift.Struct.write = function (structdef, output, struct) {
        var fid;
        var field;
        var value;
        output.writeStructBegin(structdef.alias);

        for (fid in structdef.fields) {
            field = structdef.fields[fid];
            value = struct[field.alias];
            if (value !== null && value !== undefined) {
                output.writeFieldBegin(field.alias, Thrift.serializedType(field.type), fid);
                if (field.def) {
                    new field.def.write(output, value);
                } else {
                    output.writeType(field.type, value);
                }
                output.writeFieldEnd();
            }
        }

        output.writeFieldStop();
        output.writeStructEnd();
    };

    //
    // Exceptions
    //
    Thrift.Exception = {};

    Thrift.Exception.define = function (name, fields) {
        var defaultValues = {};
        var fid;
        var field;

        fields = fields || {};

        for (fid in fields) {
            field = fields[fid];
            defaultValues[field.alias] = field.defaultValue || null;
        }

        var ThriftException = function (messageOrConfig) {
            var config = {};
            if (typeof messageOrConfig == 'object') {
                config = messageOrConfig;
            }
            Thrift.defaults(this, config, defaultValues);
            if (typeof messageOrConfig == 'string') {
                this.message = messageOrConfig;
            } else if (messageOrConfig instanceof Error) {
                this.message = messageOrConfig.message;
            }
        };

        ThriftException.alias = name;
        ThriftException.fields = fields;
        ThriftException.defaultValues = defaultValues;
        ThriftException.read = Thrift.Struct.read.bind(null, ThriftException);
        ThriftException.write = Thrift.Struct.write.bind(null, ThriftException);

        return ThriftException;
    };

    Thrift.TException = Thrift.Exception.define('TException', {
        1: { alias: 'message', type: Thrift.Type.STRING }
    });

    Thrift.TApplicationExceptionType = {
        'UNKNOWN' : 0,
        'UNKNOWN_METHOD' : 1,
        'INVALID_MESSAGE_TYPE' : 2,
        'WRONG_METHOD_NAME' : 3,
        'BAD_SEQUENCE_ID' : 4,
        'MISSING_RESULT' : 5,
        'INTERNAL_ERROR' : 6,
        'PROTOCOL_ERROR' : 7
    };

    Thrift.TApplicationException = Thrift.Exception.define('TApplicationException', {
        1: { alias: 'message', type: Thrift.Type.STRING },
        2: { alias: 'code', type: Thrift.Type.I32, 
                defaultValue: Thrift.TApplicationExceptionType.INTERNAL_ERROR }
    });


    //
    // Processor
    //
    Thrift.Processor = function () {
        this.methods = {};
    };

    Thrift.Processor.prototype.addMethod = function (mdef, fn) {
        this.methods[mdef.alias] = {
            def: mdef,
            fn: fn
        };
    };

    Thrift.Processor.prototype.process = function (input, output) {
        var method;
        var def;
        var result;
        var header;

        try {
            header = input.readMessageBegin();
            if (header.mtype != Thrift.MessageType.CALL) {
                throw new Thrift.TException('Server expects CALL but received unsupported message type: ' + header.mtype);
            }

            method = me.methods[header.fname];
            if (method == null) {
                throw new Thrift.TException('Unrecognized method name: ' + header.fname);
            }

            def = method.def;
            def.args.read(input);
            result = new def.result();

            method.fn.apply(null, def.args.values(args).concat([
                function (returnValue) {
                    result.returnValue = returnValue;
                    def.sendResponse(output, header.seqid, result);
                },
                function (err) {
                    //console.log(err);
                    var seqid = header ? header.seqid : -1;
                    if (result && def.result.setByDef(result, err)) {
                        def.sendResponse(output, header.seqid, result);
                    } else {
                        Thrift.Method.sendException(output, seqid, err);
                    }
                }
            ]));
        } catch (err) {
            console.log(err);
            var seqid = header ? header.seqid : -1;
            if (result && def.result.setByDef(result, err)) {
                def.sendResponse(output, header.seqid, result);
            } else {
                Thrift.Method.sendException(output, seqid, err);
            }
        }
    };

    return Thrift;
});

define('TBinaryProtocol',['require','thrift'],function (require) {
    'use strict'

    var Thrift = require('thrift');
    var Type = Thrift.Type;

    // NastyHaxx. JavaScript forces hex constants to be
    // positive, converting this into a long. If we hardcode the int value
    // instead it'll stay in 32 bit-land.

    var VERSION_MASK = -65536, // 0xffff0000
        VERSION_1 = -2147418112, // 0x80010000
        TYPE_MASK = 0x000000ff;

    function BinaryProtocol(trans, strictRead, strictWrite) {
        this.transport = this.trans = trans;
        this.strictRead = (strictRead !== undefined ? strictRead : false);
        this.strictWrite = (strictWrite !== undefined ? strictWrite : true);
    }

    BinaryProtocol.prototype.flush = function (callback) {
        var wrapTransport;

        if (callback) {
            wrapTransport = function (err, transport) {
                var protocol;
                if (transport) protocol = new BinaryProtocol(transport);
                return callback(err, protocol);
            };
        }

        return this.trans.flush(wrapTransport);
    };

    BinaryProtocol.prototype.writeMessageBegin = function (name, type, seqid) {
        if (this.strictWrite) {
            this.writeI32(VERSION_1 | type);
            this.writeString(name);
            this.writeI32(seqid);
        } else {
            this.writeString(name);
            this.writeByte(type);
            this.writeI32(seqid);
        }
    };

    BinaryProtocol.prototype.writeMessageEnd = function () {
    };

    BinaryProtocol.prototype.writeStructBegin = function (name) {
    };

    BinaryProtocol.prototype.writeStructEnd = function () {
    };

    BinaryProtocol.prototype.writeFieldBegin = function (name, type, id) {
        this.writeByte(type);
        this.writeI16(id);
    };

    BinaryProtocol.prototype.writeFieldEnd = function () {
    };

    BinaryProtocol.prototype.writeFieldStop = function () {
        this.writeByte(Type.STOP);
    };

    BinaryProtocol.prototype.writeMapBegin = function (ktype, vtype, size) {
        this.writeByte(ktype);
        this.writeByte(vtype);
        this.writeI32(size);
    };

    BinaryProtocol.prototype.writeMapEnd = function () {
    };

    BinaryProtocol.prototype.writeListBegin = function (etype, size) {
        this.writeByte(etype);
        this.writeI32(size);
    };

    BinaryProtocol.prototype.writeListEnd = function () {
    };

    BinaryProtocol.prototype.writeSetBegin = function (etype, size) {
        this.writeByte(etype);
        this.writeI32(size);
    };

    BinaryProtocol.prototype.writeSetEnd = function () {
    };

    BinaryProtocol.prototype.writeBool = function (bool) {
        if (bool) {
            this.writeByte(1);
        } else {
            this.writeByte(0);
        }
    };

    BinaryProtocol.prototype.writeByte = function (b) {
        this.trans.write(BinaryParser.fromByte(b));
    };

    BinaryProtocol.prototype.writeBinary = function (bytes) {
          if(typeof bytes === "string") {
            bytes = BinaryParser.fromString(bytes);
          }
          if (bytes.byteLength) {
            this.writeI32(bytes.byteLength);
          } else {
            throw Error("Cannot read length of binary data");
          }
          this.trans.write(bytes);
    }; 

    BinaryProtocol.prototype.writeI16 = function (i16) {
        this.trans.write(BinaryParser.fromShort(i16));
    };

    BinaryProtocol.prototype.writeI32 = function (i32) {
        this.trans.write(BinaryParser.fromInt(i32));
    };

    BinaryProtocol.prototype.writeI64 = function (i64) {
        this.trans.write(BinaryParser.fromLong(i64));
    };

    BinaryProtocol.prototype.writeDouble = function (dub) {
        this.trans.write(BinaryParser.fromDouble(dub));
    };

    BinaryProtocol.prototype.writeString = function (str) {
        var bytes = BinaryParser.fromString(str);
        this.writeI32(bytes.byteLength);
        this.trans.write(bytes);
    };

    BinaryProtocol.prototype.writeType = function(type, value) {
        switch (type) {
            case Type.BOOL:
                return this.writeBool(value);
            case Type.BYTE:
                return this.writeByte(value);
            case Type.I16:
                return this.writeI16(value);
            case Type.I32:
                return this.writeI32(value);
            case Type.I64:
                return this.writeI64(value);
            case Type.DOUBLE:
                return this.writeDouble(value);
            case Type.STRING:
                return this.writeString(value);
            case Type.BINARY:
                return this.writeBinary(value);
    //            case Type.STRUCT:
    //            case Type.MAP:
    //            case Type.SET:
    //            case Type.LIST:
            default:
                throw Error("Invalid type: " + type);
        }
    };

    BinaryProtocol.prototype.readMessageBegin = function () {
        var size = this.readI32();
        var signature = {
            mtype: null,
            fname: null,
            seqid: null
        };

        if (size < 0) {
            // size written at server: -2147418110 == 0x80010002
            var version = size & VERSION_MASK;
            if (version != VERSION_1) {
                console.log("BAD: " + version);
                throw Error("Bad version in readMessageBegin: " + size);
            }
            signature.mtype = size & TYPE_MASK;
            signature.fname = this.readString();
            signature.seqid = this.readI32();
        } else {
            if (this.strictRead) {
                throw Error("No protocol version header");
            }

            signature.fname = this.trans.read(size);
            signature.mtype = this.readByte();
            signature.seqid = this.readI32();
        }

        return signature;
    };

    BinaryProtocol.prototype.readMessageEnd = function () {
        // Do nothing
    };

    BinaryProtocol.prototype.readStructBegin = function () {
        return {fname: ''}; // Where is this return value used? Can it be removed?
    };

    BinaryProtocol.prototype.readStructEnd = function () {
        // Do nothing
    };

    BinaryProtocol.prototype.readFieldBegin = function () {
        var type = this.readByte();
        var field = {
            fname: null,
            ftype: type,
            fid: 0
        };

        if (type != Type.STOP) {
            field.fid = this.readI16();
        }

        return field;
    };

    BinaryProtocol.prototype.readFieldEnd = function () {
        // Do nothing
    };

    BinaryProtocol.prototype.readMapBegin = function () {
        // Add variables required by thrift generated js code but not needed for BinaryHttpTransport
        var result = {
            ktype: null, 
            vtype: null, 
            size: null
        };

        result.ktype = this.readByte();
        result.vtype = this.readByte();
        result.size = this.readI32();

        return result;
    };

    BinaryProtocol.prototype.readMapEnd = function () {
        // Do nothing
    };

    BinaryProtocol.prototype.readListBegin = function () {
        var result = {
            etype: null,
            size: null
        };
        result.etype = this.readByte();
        result.size = this.readI32();
        return result;
    };

    BinaryProtocol.prototype.readListEnd = function () {
        // Do nothing
    };

    BinaryProtocol.prototype.readSetBegin = function () {
        var result = {
            etype: null,
            size: null
        };
        result.etype = this.readByte();
        result.size = this.readI32();
        return result;
    };

    BinaryProtocol.prototype.readSetEnd = function () {
        // Do nothing
    };

    BinaryProtocol.prototype.readBool = function () {
        var b = this.readByte();
        return (b == 1);
    };

    // ThriftJS expects values to be wrapped in an object with a prop named "value"
    BinaryProtocol.prototype.readByte = function () {
        var dataview = this.trans.read(1);
        var result = BinaryParser.toByte(dataview);
        return result;
    };

    BinaryProtocol.prototype.readI16 = function () {
        var dataview = this.trans.read(2);
        var result = BinaryParser.toShort(dataview);
        return result;
    };

    BinaryProtocol.prototype.readI32 = function () {
        var dataview = this.trans.read(4);
        var result = BinaryParser.toInt(dataview);
        return result;
    };

    BinaryProtocol.prototype.readI64 = function () {
        var dataview = this.trans.read(8);
        var result = BinaryParser.toLong(dataview);
        return result;
    };

    BinaryProtocol.prototype.readDouble = function () {
        var dataview = this.trans.read(8);
        var result = BinaryParser.toDouble(dataview);
        return result;
    };

    BinaryProtocol.prototype.readBinary = function () {
        var len = this.readI32();
        var dataview = this.trans.read(len);
        var result = BinaryParser.toBytes(dataview);
        return result;
    };

    BinaryProtocol.prototype.readString = function () {
        var len = this.readI32();
        var dataview = this.trans.read(len);
        var result = BinaryParser.toString(dataview);
        return result;
    };

    BinaryProtocol.prototype.readType = function(type) {
        switch (type) {
            case Type.BOOL:
                return this.readBool();
            case Type.BYTE:
                return this.readByte();
            case Type.I16:
                return this.readI16();
            case Type.I32:
                return this.readI32();
            case Type.I64:
                return this.readI64();
            case Type.DOUBLE:
                return this.readDouble();
            case Type.STRING:
                return this.readString();
            case Type.BINARY:
                return this.readBinary();
    //            case Type.STRUCT:
    //            case Type.MAP:
    //            case Type.SET:
    //            case Type.LIST:
            default:
                throw new Error("Invalid type: " + type);
        }
    };

    BinaryProtocol.prototype.getTransport = function () {
        return this.trans;
    };

    BinaryProtocol.prototype.skipStruct = function() {
        this.readStructBegin();
        this.skipFields();
        this.readStructEnd();
    };

    BinaryProtocol.prototype.skipFields = function() {
        var r = this.readFieldBegin();
        if (r.ftype === Type.STOP) return;

        this.skip(r.ftype);
        this.readFieldEnd();
        this.skipFields();
    };

    BinaryProtocol.prototype.skipMap = function() {
        var i = 0;
        var map = this.readMapBegin();
        for (i = 0; i < map.size; i++) {
            this.skip(map.ktype);
            this.skip(map.vtype);
        }
        this.readMapEnd();
    };

    BinaryProtocol.prototype.skipSet = function() {
        var i = 0;
        var set = this.readSetBegin();
        for (i = 0; i < set.size; i++) {
            this.skip(set.etype);
        }
        this.readSetEnd();
    };

    BinaryProtocol.prototype.skipList = function() {
        var i = 0;
        var list = this.readListBegin();
        for (i = 0; i < list.size; i++) {
            this.skip(list.etype);
        }
        this.readListEnd();
    };

    BinaryProtocol.prototype.skip = function(type) {
        // console.log("skip: " + type);
        switch (type) {
            case Type.STOP:
                return;
            case Type.BOOL:
                return this.readBool();
            case Type.BYTE:
                return this.readByte();
            case Type.I16:
                return this.readI16();
            case Type.I32:
                return this.readI32();
            case Type.I64:
                return this.readI64();
            case Type.DOUBLE:
                return this.readDouble();
            case Type.STRING:
                return this.readString();
            case Type.STRUCT:
                return this.skipStruct();
            case Type.MAP:
                return this.skipMap();
            case Type.SET:
                return this.skipSet();
            case Type.LIST:
                return this.skipList();
            case Type.BINARY:
                return this.readBinary();
            default:
                throw Error("Invalid type: " + type);
        }
    };


    var BinaryParser = {};

    BinaryParser.fromByte = function (b) {
        var buffer = new ArrayBuffer(1);
        new DataView(buffer).setInt8(0, b);
        return buffer;
    };

    BinaryParser.fromShort = function (i16) {
        i16 = parseInt(i16);
        var buffer = new ArrayBuffer(2);
        new DataView(buffer).setInt16(0, i16);
        return buffer;
    };

    BinaryParser.fromInt = function (i32) {
        i32 = parseInt(i32);
        var buffer = new ArrayBuffer(4);
        new DataView(buffer).setInt32(0, i32);
        return buffer;
    };

    BinaryParser.fromLong = function (n) {
        n = parseInt(n);
        if (Math.abs(n) >= Math.pow(2, 53)) {
            throw new Error('Unable to accurately transfer numbers larger than 2^53 - 1 as integers. '
                + 'Number provided was ' + n);
        }

        var bits = (Array(64).join('0') + Math.abs(n).toString(2)).slice(-64);
        if (n < 0) bits = this.twosCompliment(bits);

        var buffer = new ArrayBuffer(8);
        var dataview = new DataView(buffer);
        for (var i = 0; i < 8; i++) {
            var uint8 = parseInt(bits.substr(8 * i, 8), 2);
            dataview.setUint8(i, uint8);
        }

        return buffer;
    };

    BinaryParser.twosCompliment = function (bits) {
        // Convert to two's compliment using string manipulation because bitwise operator is limited to 32 bit numbers
        var smallestOne = bits.lastIndexOf('1');
        var left = bits.substring(0, smallestOne).
            replace(/1/g, 'x').
            replace(/0/g, '1').
            replace(/x/g, '0');
        bits = left + bits.substring(smallestOne);
        return bits;
    };

    BinaryParser.fromDouble = function (d) {
        var buffer = new ArrayBuffer(8);
        new DataView(buffer).setFloat64(0, d);
        return buffer;
    };

    BinaryParser.fromString = function (s) {
            var i;
            var utf8 = unescape(encodeURIComponent(s));
            var len = utf8.length;
            var bytes = new Uint8Array(len);

            for (i = 0; i < len; i++) {
                bytes[i] = utf8.charCodeAt(i);
            }
            return bytes.buffer;
    };

    BinaryParser.toByte = function (dataview) {
        return dataview.getUint8(0);
    };

    BinaryParser.toBytes = function (dataview) {
        var len = dataview.byteLength;
        var array = new Uint8Array(len);
        var i;
        for (i = 0; i < len; i++) {
            array[i] = dataview.getUint8(i);
        }
        return array;
    };

    BinaryParser.toShort = function (dataview) {
        return dataview.getInt16(0);
    };

    BinaryParser.toInt = function (dataview) {
        return dataview.getInt32(0);
    };

    BinaryParser.toLong = function (dataview) {
        // Javascript does not support 64-bit integers. Only decode values up to 2^53 - 1.
        var sign = 1;
        var bits = '';
        for (var i = 0; i < 8; i++) {
            bits += (Array(8).join('0') + dataview.getUint8(i).toString(2)).slice(-8);
        }

        if (bits[0] === '1') {
            sign = -1;
            bits = this.twosCompliment(bits);
        }
        var largestOne = bits.indexOf('1');
        if (largestOne != -1 && largestOne < 64 - 54) throw new Error('Unable to receive number larger than 2^53 - 1 as an integer');

        return parseInt(bits, 2) * sign;
    };

    BinaryParser.toDouble = function (dataview) {
        return dataview.getFloat64(0);
    };

    BinaryParser.toString = function (dataview) {
        var s = '';
        var i;
        var len = dataview.byteLength;
        var hex;

        for (i = 0; i < len; i++) {
            hex = dataview.getUint8(i).toString(16);
            if (hex.length == 1) hex = '0' + hex;
            s += '%' + hex;
        }

        s = decodeURIComponent(s);
        return s;
    };

    return BinaryProtocol;
});
/**
 * Utility functions for getting and setting cookies.
 */
define('cookies',["common"], function(common) {
  var DELIMITER = "; ";
  var MAX_LENGTH = 4096;
  /**
   * Split a cookie into its name and value parts.
   * 
   * Returns an array where ret[0] is the cookie name and ret[1] is the cookie
   * value
   */
  function splitCookie(cookieString) {
    var idx = cookieString.indexOf("=");
    if (idx < 1) {
      throw new Error("Invalid cookie value: " + cookieString);
    }
    return [cookieString.substring(0, idx), cookieString.substring(idx + 1)];
  }
  return { 
    /**
     * Get the value of the cookie with the given name.
     */ 
    get : function getCookie(name) {
      // split the cookie string into the component cookies
      var cookies = document.cookie.split(DELIMITER);
      for (var i = 0; i < cookies.length; i++) {
        var cookiePair = splitCookie(cookies[i]);
        if (cookiePair[0] === name) {
          // name matches, return value
          return unescape(cookiePair[1]);
        }
      }
      // no cookie found with the given name
      return "";
    },
    /**
     * Set the name cookie to the passed value with an expiry ttl millis in the
     * future. If ttl is -1, the cookie created will be a session cookie.
     */
    set : function(name, value, ttl, path) {
      var cookie = name + "=" + escape(value) + DELIMITER;
      if (ttl > -1) {
        var now = new Date();
        now.setTime(now.getTime() + ttl);
        expires = now.toGMTString();
      } else if (ttl == -1) {
        // session cookie
        expires = "0";
      } else {
        // Invalid ttl, don't create cookie
        throw "cookies: ttl must be >= -1 but was " + ttl;
      }
      // IE requires leaving out "expires" if it's a session cookie
      if (expires !== "0" || !common.isIE) {
        cookie += "expires=" + expires + DELIMITER;
      }

      if (document.location.href.indexOf('https') === 0) {
        cookie += "secure";
        cookie += DELIMITER;
      }

      if (!path) {
        path = "/";
      }
      cookie += "path=" + path + DELIMITER;

      if (cookie.length > MAX_LENGTH) {
        throw new QuotaExceededError();
      }
      document.cookie = cookie;
    },
    unset : function(name) {
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
  };
});

define('local-storage',["cookies"], function(cookies) {
  var supportsLocalStorage;
  var isSafariPrivateBrowsing = false;
  var storage = {};
  var prefix = "en_store_";

  try {
    supportsLocalStorage = 'localStorage' in window
        && window['localStorage'] !== null;
  } catch (e) {
    supportsLocalStorage = false;
  };

  /* heuristic for checking safari private browsing. safari sets quota to 0 in private
   * resulting in a quota error being thrown whenever an item is attempted to be set
   * This will catch any error in localStorage functionality, though legitimate
   * localStorage failures are very difficult to come by.
   */
  try {
    localStorage.setItem("test", "test");
    localStorage.removeItem("test");
  } catch (e) {
    isSafariPrivateBrowsing = true;
  };

  function getStdLocalStorage() {
    return {
      getItem : function(key) {
        return localStorage.getItem(prefix + key);
      },
      setItem : function(key, data) {
        localStorage.setItem(prefix + key, data);
      },
      removeItem : function(key) {
        localStorage.removeItem(prefix + key);
      }
    };
  };

  function getCookieLocalStorage() {
    return {
      getItem : function(key) {
        return cookies.get(prefix + key) || null;
      },
      setItem : function(key, data) {
        cookies.set(prefix + key, data, -1);
      },
      removeItem : function(key) {
        cookies.unset(prefix + name);
      }
    };
  };

  function getInMemory() {
    return {
      setItem : function(key, value) {
        storage[key] = value;
      },
      removeItem : function(key) {
        delete(storage[key]);
      },
      getItem : function(key) {
        return storage[key] || null;
      }
    };
  };

  /**
   * obtain default tree of local storage structs
   * priority is:
   *   - localStorage
   *   - in memory iff localStorage is available but with errors
   *   - cookies
   *   - in memory
   */
  function getLocalStorageStructDefault() {
    if (supportsLocalStorage) {
      if (!isSafariPrivateBrowsing) {
        return getStdLocalStorage();
      } else {
        // localStorage is available but not fully functional, usually as a result of
        // running out of quota or Safari setting the quota to 0 in private browsing
        return getInMemory();
      }
    } else if (document.cookie) {
      // local storage is not supported, use cookies
      return getCookieLocalStorage();
    } else {
      // We don't have anywhere else to store things, return in memory impl.
      return getInMemory();
    }
  };

  var storage = {
    isAvailable : function() {
      return supportsLocalStorage;
    }
  };

  return $.extend(storage, getLocalStorageStructDefault());
});

/**
 * A transport which captures the serialized result of a thrift call and saves
 * it.
 */
define('ArrayBufferSerializerTransport',[ 'thrift' ], function() {
  var Transport = function() {
    this.buffer = [];
    this.readOffset = 0;
  };

  (function(p) {
    p.reset = function() {
      this.buffer = [];
      this.readOffset = 0;
    },

    p.getBytes = function() {
      var size = this.buffer.reduce(function(size, bytes) {
        return size + bytes.byteLength;
      }, 0);

      var allbytes = new Uint8Array(new ArrayBuffer(size));
      var pos = 0;
      this.buffer.forEach(function(bytes) {
        var view = null;
        if (bytes.buffer)
          view = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(
              bytes.buffer, bytes.byteOffset, bytes.byteLength);
        else
          view = new Uint8Array(bytes);

        allbytes.set(view, pos);
        pos += bytes.byteLength;
      });

      return allbytes;
    },

    p.open = function() {
    };

    p.close = function() {
    };

    p.read = function(len) {
      var view = new DataView(this.getBytes().buffer, this.readOffset, len);
      this.readOffset += len;
      return view;
    };

    p.write = function(bytes) {
      this.buffer.push(bytes);
    };

    p.flush = function(async) {
    };

    p.send = function(client, postData, args, recv_method) {
    };

  })(Transport.prototype);

  return Transport;
});

/**
 * Assertion utilities for checking argument types and presence
 */
define('preconditions',[ 'jquery' ], function($) {
  return {
    assert : function(assertion, failMessage) {
      if (!assertion) {
        throw new Error(failMessage);
      }
    },
    assertIsArray : function(obj) {
      this.assert($.isArray(obj), 'Passed object is not an array');
    },
    assertIsFunction : function(obj) {
      this.assert($.isFunction(obj), 'Passed object is not a function');
    },
    assertIsString : function(obj) {
      this.assert(typeof obj === 'string');
    },
    assertIsNotNull : function(obj) {
      this.assert(obj != null, 'Passed object was null');
    },
    assertIsNotUndefined : function(obj) {
      this.assert(typeof obj !== 'undefined');
    }
  };
});

/**
 * All shims needed to make IE8 and IE9 support the ES5 spec as well as is possible.
 * The full list of shim libraries provided is:
 * es5-shim
 * es5-sham
 * console-polyfill
 * a small subset of es6 utility functions. most of the es6 spec is shimmable only in IE9+
 * (available via conditional comment in layout.jsp) html5shiv
 */

/*
 * es5-shim and es5-sham
 */
(function() {
  /**
   * Brings an environment as close to ECMAScript 5 compliance
   * as is possible with the facilities of erstwhile engines.
   *
   * Annotated ES5: http://es5.github.com/ (specific links below)
   * ES5 Spec: http://www.ecma-international.org/publications/files/ECMA-ST/Ecma-262.pdf
   * Required reading: http://javascriptweblog.wordpress.com/2011/12/05/extending-javascript-natives/
   */

  // Shortcut to an often accessed properties, in order to avoid multiple
  // dereference that costs universally.
  var ArrayPrototype = Array.prototype;
  var ObjectPrototype = Object.prototype;
  var FunctionPrototype = Function.prototype;
  var StringPrototype = String.prototype;
  var NumberPrototype = Number.prototype;
  var array_slice = ArrayPrototype.slice;
  var array_splice = ArrayPrototype.splice;
  var array_push = ArrayPrototype.push;
  var array_unshift = ArrayPrototype.unshift;
  var call = FunctionPrototype.call;

  // Having a toString local variable name breaks in Opera so use _toString.
  var _toString = ObjectPrototype.toString;

  var isFunction = function (val) {
      return ObjectPrototype.toString.call(val) === '[object Function]';
  };
  var isRegex = function (val) {
      return ObjectPrototype.toString.call(val) === '[object RegExp]';
  };
  var isArray = function isArray(obj) {
      return _toString.call(obj) === "[object Array]";
  };
  var isString = function isString(obj) {
      return _toString.call(obj) === "[object String]";
  };
  var isArguments = function isArguments(value) {
      var str = _toString.call(value);
      var isArgs = str === '[object Arguments]';
      if (!isArgs) {
          isArgs = !isArray(value)
              && value !== null
              && typeof value === 'object'
              && typeof value.length === 'number'
              && value.length >= 0
              && isFunction(value.callee);
      }
      return isArgs;
  };

  var supportsDescriptors = Object.defineProperty && (function () {
      try {
          Object.defineProperty({}, 'x', {});
          return true;
      } catch (e) { /* this is ES3 */
          return false;
      }
  }());

  // Define configurable, writable and non-enumerable props
  // if they don't exist.
  var defineProperty;
  if (supportsDescriptors) {
      defineProperty = function (object, name, method, forceAssign) {
          if (!forceAssign && (name in object)) { return; }
          Object.defineProperty(object, name, {
              configurable: true,
              enumerable: false,
              writable: true,
              value: method
          });
      };
  } else {
      defineProperty = function (object, name, method, forceAssign) {
          if (!forceAssign && (name in object)) { return; }
          object[name] = method;
      };
  }
  var defineProperties = function (object, map, forceAssign) {
      for (var name in map) {
          if (ObjectPrototype.hasOwnProperty.call(map, name)) {
            defineProperty(object, name, map[name], forceAssign);
          }
      }
  };

  //
  // Util
  // ======
  //

  // ES5 9.4
  // http://es5.github.com/#x9.4
  // http://jsperf.com/to-integer

  function toInteger(n) {
      n = +n;
      if (n !== n) { // isNaN
          n = 0;
      } else if (n !== 0 && n !== (1 / 0) && n !== -(1 / 0)) {
          n = (n > 0 || -1) * Math.floor(Math.abs(n));
      }
      return n;
  }

  function isPrimitive(input) {
      var type = typeof input;
      return (
          input === null ||
          type === "undefined" ||
          type === "boolean" ||
          type === "number" ||
          type === "string"
      );
  }

  function toPrimitive(input) {
      var val, valueOf, toStr;
      if (isPrimitive(input)) {
          return input;
      }
      valueOf = input.valueOf;
      if (isFunction(valueOf)) {
          val = valueOf.call(input);
          if (isPrimitive(val)) {
              return val;
          }
      }
      toStr = input.toString;
      if (isFunction(toStr)) {
          val = toStr.call(input);
          if (isPrimitive(val)) {
              return val;
          }
      }
      throw new TypeError();
  }

  // ES5 9.9
  // http://es5.github.com/#x9.9
  var toObject = function (o) {
      if (o == null) { // this matches both null and undefined
          throw new TypeError("can't convert " + o + " to object");
      }
      return Object(o);
  };

  var ToUint32 = function ToUint32(x) {
      return x >>> 0;
  };

  //
  // Function
  // ========
  //

  // ES-5 15.3.4.5
  // http://es5.github.com/#x15.3.4.5

  function Empty() {}

  defineProperties(FunctionPrototype, {
      bind: function bind(that) { // .length is 1
          // 1. Let Target be the this value.
          var target = this;
          // 2. If IsCallable(Target) is false, throw a TypeError exception.
          if (!isFunction(target)) {
              throw new TypeError("Function.prototype.bind called on incompatible " + target);
          }
          // 3. Let A be a new (possibly empty) internal list of all of the
          //   argument values provided after thisArg (arg1, arg2 etc), in order.
          // XXX slicedArgs will stand in for "A" if used
          var args = array_slice.call(arguments, 1); // for normal call
          // 4. Let F be a new native ECMAScript object.
          // 11. Set the [[Prototype]] internal property of F to the standard
          //   built-in Function prototype object as specified in 15.3.3.1.
          // 12. Set the [[Call]] internal property of F as described in
          //   15.3.4.5.1.
          // 13. Set the [[Construct]] internal property of F as described in
          //   15.3.4.5.2.
          // 14. Set the [[HasInstance]] internal property of F as described in
          //   15.3.4.5.3.
          var binder = function () {

              if (this instanceof bound) {
                  // 15.3.4.5.2 [[Construct]]
                  // When the [[Construct]] internal method of a function object,
                  // F that was created using the bind function is called with a
                  // list of arguments ExtraArgs, the following steps are taken:
                  // 1. Let target be the value of F's [[TargetFunction]]
                  //   internal property.
                  // 2. If target has no [[Construct]] internal method, a
                  //   TypeError exception is thrown.
                  // 3. Let boundArgs be the value of F's [[BoundArgs]] internal
                  //   property.
                  // 4. Let args be a new list containing the same values as the
                  //   list boundArgs in the same order followed by the same
                  //   values as the list ExtraArgs in the same order.
                  // 5. Return the result of calling the [[Construct]] internal
                  //   method of target providing args as the arguments.

                  var result = target.apply(
                      this,
                      args.concat(array_slice.call(arguments))
                  );
                  if (Object(result) === result) {
                      return result;
                  }
                  return this;

              } else {
                  // 15.3.4.5.1 [[Call]]
                  // When the [[Call]] internal method of a function object, F,
                  // which was created using the bind function is called with a
                  // this value and a list of arguments ExtraArgs, the following
                  // steps are taken:
                  // 1. Let boundArgs be the value of F's [[BoundArgs]] internal
                  //   property.
                  // 2. Let boundThis be the value of F's [[BoundThis]] internal
                  //   property.
                  // 3. Let target be the value of F's [[TargetFunction]] internal
                  //   property.
                  // 4. Let args be a new list containing the same values as the
                  //   list boundArgs in the same order followed by the same
                  //   values as the list ExtraArgs in the same order.
                  // 5. Return the result of calling the [[Call]] internal method
                  //   of target providing boundThis as the this value and
                  //   providing args as the arguments.

                  // equiv: target.call(this, ...boundArgs, ...args)
                  return target.apply(
                      that,
                      args.concat(array_slice.call(arguments))
                  );

              }

          };

          // 15. If the [[Class]] internal property of Target is "Function", then
          //     a. Let L be the length property of Target minus the length of A.
          //     b. Set the length own property of F to either 0 or L, whichever is
          //       larger.
          // 16. Else set the length own property of F to 0.

          var boundLength = Math.max(0, target.length - args.length);

          // 17. Set the attributes of the length own property of F to the values
          //   specified in 15.3.5.1.
          var boundArgs = [];
          for (var i = 0; i < boundLength; i++) {
              boundArgs.push("$" + i);
          }

          // XXX Build a dynamic function with desired amount of arguments is the only
          // way to set the length property of a function.
          // In environments where Content Security Policies enabled (Chrome extensions,
          // for ex.) all use of eval or Function costructor throws an exception.
          // However in all of these environments Function.prototype.bind exists
          // and so this code will never be executed.
          var bound = Function("binder", "return function (" + boundArgs.join(",") + "){return binder.apply(this,arguments)}")(binder);

          if (target.prototype) {
              Empty.prototype = target.prototype;
              bound.prototype = new Empty();
              // Clean up dangling references.
              Empty.prototype = null;
          }

          // TODO
          // 18. Set the [[Extensible]] internal property of F to true.

          // TODO
          // 19. Let thrower be the [[ThrowTypeError]] function Object (13.2.3).
          // 20. Call the [[DefineOwnProperty]] internal method of F with
          //   arguments "caller", PropertyDescriptor {[[Get]]: thrower, [[Set]]:
          //   thrower, [[Enumerable]]: false, [[Configurable]]: false}, and
          //   false.
          // 21. Call the [[DefineOwnProperty]] internal method of F with
          //   arguments "arguments", PropertyDescriptor {[[Get]]: thrower,
          //   [[Set]]: thrower, [[Enumerable]]: false, [[Configurable]]: false},
          //   and false.

          // TODO
          // NOTE Function objects created using Function.prototype.bind do not
          // have a prototype property or the [[Code]], [[FormalParameters]], and
          // [[Scope]] internal properties.
          // XXX can't delete prototype in pure-js.

          // 22. Return F.
          return bound;
      }
  });

  // _Please note: Shortcuts are defined after `Function.prototype.bind` as we
  // us it in defining shortcuts.
  var owns = call.bind(ObjectPrototype.hasOwnProperty);

  // If JS engine supports accessors creating shortcuts.
  var defineGetter;
  var defineSetter;
  var lookupGetter;
  var lookupSetter;
  var supportsAccessors;
  if ((supportsAccessors = owns(ObjectPrototype, "__defineGetter__"))) {
      defineGetter = call.bind(ObjectPrototype.__defineGetter__);
      defineSetter = call.bind(ObjectPrototype.__defineSetter__);
      lookupGetter = call.bind(ObjectPrototype.__lookupGetter__);
      lookupSetter = call.bind(ObjectPrototype.__lookupSetter__);
  }

  //
  // Array
  // =====
  //

  // ES5 15.4.4.12
  // http://es5.github.com/#x15.4.4.12
  var spliceNoopReturnsEmptyArray = (function () {
      var a = [1, 2];
      var result = a.splice();
      return a.length === 2 && isArray(result) && result.length === 0;
  }());
  defineProperties(ArrayPrototype, {
      // Safari 5.0 bug where .splice() returns undefined
      splice: function splice(start, deleteCount) {
          if (arguments.length === 0) {
              return [];
          } else {
              return array_splice.apply(this, arguments);
          }
      }
  }, spliceNoopReturnsEmptyArray);

  var spliceWorksWithEmptyObject = (function () {
      var obj = {};
      ArrayPrototype.splice.call(obj, 0, 0, 1);
      return obj.length === 1;
  }());
  defineProperties(ArrayPrototype, {
      splice: function splice(start, deleteCount) {
          if (arguments.length === 0) { return []; }
          var args = arguments;
          this.length = Math.max(toInteger(this.length), 0);
          if (arguments.length > 0 && typeof deleteCount !== 'number') {
              args = array_slice.call(arguments);
              if (args.length < 2) {
                  args.push(this.length - start);
              } else {
                  args[1] = toInteger(deleteCount);
              }
          }
          return array_splice.apply(this, args);
      }
  }, !spliceWorksWithEmptyObject);

  // ES5 15.4.4.12
  // http://es5.github.com/#x15.4.4.13
  // Return len+argCount.
  // [bugfix, ielt8]
  // IE < 8 bug: [].unshift(0) === undefined but should be "1"
  var hasUnshiftReturnValueBug = [].unshift(0) !== 1;
  defineProperties(ArrayPrototype, {
      unshift: function () {
          array_unshift.apply(this, arguments);
          return this.length;
      }
  }, hasUnshiftReturnValueBug);

  // ES5 15.4.3.2
  // http://es5.github.com/#x15.4.3.2
  // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/isArray
  defineProperties(Array, { isArray: isArray });

  // The IsCallable() check in the Array functions
  // has been replaced with a strict check on the
  // internal class of the object to trap cases where
  // the provided function was actually a regular
  // expression literal, which in V8 and
  // JavaScriptCore is a typeof "function".  Only in
  // V8 are regular expression literals permitted as
  // reduce parameters, so it is desirable in the
  // general case for the shim to match the more
  // strict and common behavior of rejecting regular
  // expressions.

  // ES5 15.4.4.18
  // http://es5.github.com/#x15.4.4.18
  // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/array/forEach

  // Check failure of by-index access of string characters (IE < 9)
  // and failure of `0 in boxedString` (Rhino)
  var boxedString = Object("a");
  var splitString = boxedString[0] !== "a" || !(0 in boxedString);

  var properlyBoxesContext = function properlyBoxed(method) {
      // Check node 0.6.21 bug where third parameter is not boxed
      var properlyBoxesNonStrict = true;
      var properlyBoxesStrict = true;
      if (method) {
          method.call('foo', function (_, __, context) {
              if (typeof context !== 'object') { properlyBoxesNonStrict = false; }
          });

          method.call([1], function () {
              
              properlyBoxesStrict = typeof this === 'string';
          }, 'x');
      }
      return !!method && properlyBoxesNonStrict && properlyBoxesStrict;
  };

  defineProperties(ArrayPrototype, {
      forEach: function forEach(fun /*, thisp*/) {
          var object = toObject(this),
              self = splitString && isString(this) ? this.split('') : object,
              thisp = arguments[1],
              i = -1,
              length = self.length >>> 0;

          // If no callback function or if callback is not a callable function
          if (!isFunction(fun)) {
              throw new TypeError(); // TODO message
          }

          while (++i < length) {
              if (i in self) {
                  // Invoke the callback function with call, passing arguments:
                  // context, property value, property key, thisArg object
                  // context
                  fun.call(thisp, self[i], i, object);
              }
          }
      }
  }, !properlyBoxesContext(ArrayPrototype.forEach));

  // ES5 15.4.4.19
  // http://es5.github.com/#x15.4.4.19
  // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/map
  defineProperties(ArrayPrototype, {
      map: function map(fun /*, thisp*/) {
          var object = toObject(this),
              self = splitString && isString(this) ? this.split('') : object,
              length = self.length >>> 0,
              result = Array(length),
              thisp = arguments[1];

          // If no callback function or if callback is not a callable function
          if (!isFunction(fun)) {
              throw new TypeError(fun + " is not a function");
          }

          for (var i = 0; i < length; i++) {
              if (i in self) {
                  result[i] = fun.call(thisp, self[i], i, object);
              }
          }
          return result;
      }
  }, !properlyBoxesContext(ArrayPrototype.map));

  // ES5 15.4.4.20
  // http://es5.github.com/#x15.4.4.20
  // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/filter
  defineProperties(ArrayPrototype, {
      filter: function filter(fun /*, thisp */) {
          var object = toObject(this),
              self = splitString && isString(this) ? this.split('') : object,
              length = self.length >>> 0,
              result = [],
              value,
              thisp = arguments[1];

          // If no callback function or if callback is not a callable function
          if (!isFunction(fun)) {
              throw new TypeError(fun + " is not a function");
          }

          for (var i = 0; i < length; i++) {
              if (i in self) {
                  value = self[i];
                  if (fun.call(thisp, value, i, object)) {
                      result.push(value);
                  }
              }
          }
          return result;
      }
  }, !properlyBoxesContext(ArrayPrototype.filter));

  // ES5 15.4.4.16
  // http://es5.github.com/#x15.4.4.16
  // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/every
  defineProperties(ArrayPrototype, {
      every: function every(fun /*, thisp */) {
          var object = toObject(this),
              self = splitString && isString(this) ? this.split('') : object,
              length = self.length >>> 0,
              thisp = arguments[1];

          // If no callback function or if callback is not a callable function
          if (!isFunction(fun)) {
              throw new TypeError(fun + " is not a function");
          }

          for (var i = 0; i < length; i++) {
              if (i in self && !fun.call(thisp, self[i], i, object)) {
                  return false;
              }
          }
          return true;
      }
  }, !properlyBoxesContext(ArrayPrototype.every));

  // ES5 15.4.4.17
  // http://es5.github.com/#x15.4.4.17
  // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/some
  defineProperties(ArrayPrototype, {
      some: function some(fun /*, thisp */) {
          var object = toObject(this),
              self = splitString && isString(this) ? this.split('') : object,
              length = self.length >>> 0,
              thisp = arguments[1];

          // If no callback function or if callback is not a callable function
          if (!isFunction(fun)) {
              throw new TypeError(fun + " is not a function");
          }

          for (var i = 0; i < length; i++) {
              if (i in self && fun.call(thisp, self[i], i, object)) {
                  return true;
              }
          }
          return false;
      }
  }, !properlyBoxesContext(ArrayPrototype.some));

  // ES5 15.4.4.21
  // http://es5.github.com/#x15.4.4.21
  // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/reduce
  var reduceCoercesToObject = false;
  if (ArrayPrototype.reduce) {
      reduceCoercesToObject = typeof ArrayPrototype.reduce.call('es5', function (_, __, ___, list) { return list; }) === 'object';
  }
  defineProperties(ArrayPrototype, {
      reduce: function reduce(fun /*, initial*/) {
          var object = toObject(this),
              self = splitString && isString(this) ? this.split('') : object,
              length = self.length >>> 0;

          // If no callback function or if callback is not a callable function
          if (!isFunction(fun)) {
              throw new TypeError(fun + " is not a function");
          }

          // no value to return if no initial value and an empty array
          if (!length && arguments.length === 1) {
              throw new TypeError("reduce of empty array with no initial value");
          }

          var i = 0;
          var result;
          if (arguments.length >= 2) {
              result = arguments[1];
          } else {
              do {
                  if (i in self) {
                      result = self[i++];
                      break;
                  }

                  // if array contains no values, no initial value to return
                  if (++i >= length) {
                      throw new TypeError("reduce of empty array with no initial value");
                  }
              } while (true);
          }

          for (; i < length; i++) {
              if (i in self) {
                  result = fun.call(void 0, result, self[i], i, object);
              }
          }

          return result;
      }
  }, !reduceCoercesToObject);

  // ES5 15.4.4.22
  // http://es5.github.com/#x15.4.4.22
  // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/reduceRight
  var reduceRightCoercesToObject = false;
  if (ArrayPrototype.reduceRight) {
      reduceRightCoercesToObject = typeof ArrayPrototype.reduceRight.call('es5', function (_, __, ___, list) { return list; }) === 'object';
  }
  defineProperties(ArrayPrototype, {
      reduceRight: function reduceRight(fun /*, initial*/) {
          var object = toObject(this),
              self = splitString && isString(this) ? this.split('') : object,
              length = self.length >>> 0;

          // If no callback function or if callback is not a callable function
          if (!isFunction(fun)) {
              throw new TypeError(fun + " is not a function");
          }

          // no value to return if no initial value, empty array
          if (!length && arguments.length === 1) {
              throw new TypeError("reduceRight of empty array with no initial value");
          }

          var result, i = length - 1;
          if (arguments.length >= 2) {
              result = arguments[1];
          } else {
              do {
                  if (i in self) {
                      result = self[i--];
                      break;
                  }

                  // if array contains no values, no initial value to return
                  if (--i < 0) {
                      throw new TypeError("reduceRight of empty array with no initial value");
                  }
              } while (true);
          }

          if (i < 0) {
              return result;
          }

          do {
              if (i in self) {
                  result = fun.call(void 0, result, self[i], i, object);
              }
          } while (i--);

          return result;
      }
  }, !reduceRightCoercesToObject);

  // ES5 15.4.4.14
  // http://es5.github.com/#x15.4.4.14
  // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
  var hasFirefox2IndexOfBug = Array.prototype.indexOf && [0, 1].indexOf(1, 2) !== -1;
  defineProperties(ArrayPrototype, {
      indexOf: function indexOf(sought /*, fromIndex */ ) {
          var self = splitString && isString(this) ? this.split('') : toObject(this),
              length = self.length >>> 0;

          if (!length) {
              return -1;
          }

          var i = 0;
          if (arguments.length > 1) {
              i = toInteger(arguments[1]);
          }

          // handle negative indices
          i = i >= 0 ? i : Math.max(0, length + i);
          for (; i < length; i++) {
              if (i in self && self[i] === sought) {
                  return i;
              }
          }
          return -1;
      }
  }, hasFirefox2IndexOfBug);

  // ES5 15.4.4.15
  // http://es5.github.com/#x15.4.4.15
  // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/lastIndexOf
  var hasFirefox2LastIndexOfBug = Array.prototype.lastIndexOf && [0, 1].lastIndexOf(0, -3) !== -1;
  defineProperties(ArrayPrototype, {
      lastIndexOf: function lastIndexOf(sought /*, fromIndex */) {
          var self = splitString && isString(this) ? this.split('') : toObject(this),
              length = self.length >>> 0;

          if (!length) {
              return -1;
          }
          var i = length - 1;
          if (arguments.length > 1) {
              i = Math.min(i, toInteger(arguments[1]));
          }
          // handle negative indices
          i = i >= 0 ? i : length - Math.abs(i);
          for (; i >= 0; i--) {
              if (i in self && sought === self[i]) {
                  return i;
              }
          }
          return -1;
      }
  }, hasFirefox2LastIndexOfBug);

  //
  // Object
  // ======
  //

  // ES5 15.2.3.14
  // http://es5.github.com/#x15.2.3.14

  // http://whattheheadsaid.com/2010/10/a-safer-object-keys-compatibility-implementation
  var hasDontEnumBug = !({'toString': null}).propertyIsEnumerable('toString'),
      hasProtoEnumBug = (function () {}).propertyIsEnumerable('prototype'),
      dontEnums = [
          "toString",
          "toLocaleString",
          "valueOf",
          "hasOwnProperty",
          "isPrototypeOf",
          "propertyIsEnumerable",
          "constructor"
      ],
      dontEnumsLength = dontEnums.length;

  defineProperties(Object, {
      keys: function keys(object) {
          var isFn = isFunction(object),
              isArgs = isArguments(object),
              isObject = object !== null && typeof object === 'object',
              isStr = isObject && isString(object);

          if (!isObject && !isFn && !isArgs) {
              throw new TypeError("Object.keys called on a non-object");
          }

          var theKeys = [];
          var skipProto = hasProtoEnumBug && isFn;
          if (isStr || isArgs) {
              for (var i = 0; i < object.length; ++i) {
                  theKeys.push(String(i));
              }
          } else {
              for (var name in object) {
                  if (!(skipProto && name === 'prototype') && owns(object, name)) {
                      theKeys.push(String(name));
                  }
              }
          }

          if (hasDontEnumBug) {
              var ctor = object.constructor,
                  skipConstructor = ctor && ctor.prototype === object;
              for (var j = 0; j < dontEnumsLength; j++) {
                  var dontEnum = dontEnums[j];
                  if (!(skipConstructor && dontEnum === 'constructor') && owns(object, dontEnum)) {
                      theKeys.push(dontEnum);
                  }
              }
          }
          return theKeys;
      }
  });

  var keysWorksWithArguments = Object.keys && (function () {
      // Safari 5.0 bug
      return Object.keys(arguments).length === 2;
  }(1, 2));
  var originalKeys = Object.keys;
  defineProperties(Object, {
      keys: function keys(object) {
          if (isArguments(object)) {
              return originalKeys(ArrayPrototype.slice.call(object));
          } else {
              return originalKeys(object);
          }
      }
  }, !keysWorksWithArguments);

  //
  // Date
  // ====
  //

  // ES5 15.9.5.43
  // http://es5.github.com/#x15.9.5.43
  // This function returns a String value represent the instance in time
  // represented by this Date object. The format of the String is the Date Time
  // string format defined in 15.9.1.15. All fields are present in the String.
  // The time zone is always UTC, denoted by the suffix Z. If the time value of
  // this object is not a finite Number a RangeError exception is thrown.
  var negativeDate = -62198755200000;
  var negativeYearString = "-000001";
  var hasNegativeDateBug = Date.prototype.toISOString && new Date(negativeDate).toISOString().indexOf(negativeYearString) === -1;

  defineProperties(Date.prototype, {
      toISOString: function toISOString() {
          var result, length, value, year, month;
          if (!isFinite(this)) {
              throw new RangeError("Date.prototype.toISOString called on non-finite value.");
          }

          year = this.getUTCFullYear();

          month = this.getUTCMonth();
          // see https://github.com/es-shims/es5-shim/issues/111
          year += Math.floor(month / 12);
          month = (month % 12 + 12) % 12;

          // the date time string format is specified in 15.9.1.15.
          result = [month + 1, this.getUTCDate(), this.getUTCHours(), this.getUTCMinutes(), this.getUTCSeconds()];
          year = (
              (year < 0 ? "-" : (year > 9999 ? "+" : "")) +
              ("00000" + Math.abs(year)).slice(0 <= year && year <= 9999 ? -4 : -6)
          );

          length = result.length;
          while (length--) {
              value = result[length];
              // pad months, days, hours, minutes, and seconds to have two
              // digits.
              if (value < 10) {
                  result[length] = "0" + value;
              }
          }
          // pad milliseconds to have three digits.
          return (
              year + "-" + result.slice(0, 2).join("-") +
              "T" + result.slice(2).join(":") + "." +
              ("000" + this.getUTCMilliseconds()).slice(-3) + "Z"
          );
      }
  }, hasNegativeDateBug);


  // ES5 15.9.5.44
  // http://es5.github.com/#x15.9.5.44
  // This function provides a String representation of a Date object for use by
  // JSON.stringify (15.12.3).
  var dateToJSONIsSupported = false;
  try {
      dateToJSONIsSupported = (
          Date.prototype.toJSON &&
          new Date(NaN).toJSON() === null &&
          new Date(negativeDate).toJSON().indexOf(negativeYearString) !== -1 &&
          Date.prototype.toJSON.call({ // generic
              toISOString: function () {
                  return true;
              }
          })
      );
  } catch (e) {
  }
  if (!dateToJSONIsSupported) {
      Date.prototype.toJSON = function toJSON(key) {
          // When the toJSON method is called with argument key, the following
          // steps are taken:

          // 1.  Let O be the result of calling ToObject, giving it the this
          // value as its argument.
          // 2. Let tv be toPrimitive(O, hint Number).
          var o = Object(this),
              tv = toPrimitive(o),
              toISO;
          // 3. If tv is a Number and is not finite, return null.
          if (typeof tv === "number" && !isFinite(tv)) {
              return null;
          }
          // 4. Let toISO be the result of calling the [[Get]] internal method of
          // O with argument "toISOString".
          toISO = o.toISOString;
          // 5. If IsCallable(toISO) is false, throw a TypeError exception.
          if (typeof toISO !== "function") {
              throw new TypeError("toISOString property is not callable");
          }
          // 6. Return the result of calling the [[Call]] internal method of
          //  toISO with O as the this value and an empty argument list.
          return toISO.call(o);

          // NOTE 1 The argument is ignored.

          // NOTE 2 The toJSON function is intentionally generic; it does not
          // require that its this value be a Date object. Therefore, it can be
          // transferred to other kinds of objects for use as a method. However,
          // it does require that any such object have a toISOString method. An
          // object is free to use the argument key to filter its
          // stringification.
      };
  }

  // ES5 15.9.4.2
  // http://es5.github.com/#x15.9.4.2
  // based on work shared by Daniel Friesen (dantman)
  // http://gist.github.com/303249
  var supportsExtendedYears = Date.parse('+033658-09-27T01:46:40.000Z') === 1e15;
  var acceptsInvalidDates = !isNaN(Date.parse('2012-04-04T24:00:00.500Z')) || !isNaN(Date.parse('2012-11-31T23:59:59.000Z'));
  var doesNotParseY2KNewYear = isNaN(Date.parse("2000-01-01T00:00:00.000Z"));
  if (!Date.parse || doesNotParseY2KNewYear || acceptsInvalidDates || !supportsExtendedYears) {
      // XXX global assignment won't work in embeddings that use
      // an alternate object for the context.
      Date = (function (NativeDate) {

          // Date.length === 7
          function Date(Y, M, D, h, m, s, ms) {
              var length = arguments.length;
              if (this instanceof NativeDate) {
                  var date = length === 1 && String(Y) === Y ? // isString(Y)
                      // We explicitly pass it through parse:
                      new NativeDate(Date.parse(Y)) :
                      // We have to manually make calls depending on argument
                      // length here
                      length >= 7 ? new NativeDate(Y, M, D, h, m, s, ms) :
                      length >= 6 ? new NativeDate(Y, M, D, h, m, s) :
                      length >= 5 ? new NativeDate(Y, M, D, h, m) :
                      length >= 4 ? new NativeDate(Y, M, D, h) :
                      length >= 3 ? new NativeDate(Y, M, D) :
                      length >= 2 ? new NativeDate(Y, M) :
                      length >= 1 ? new NativeDate(Y) :
                                    new NativeDate();
                  // Prevent mixups with unfixed Date object
                  date.constructor = Date;
                  return date;
              }
              return NativeDate.apply(this, arguments);
          }

          // 15.9.1.15 Date Time String Format.
          var isoDateExpression = new RegExp("^" +
              "(\\d{4}|[\+\-]\\d{6})" + // four-digit year capture or sign +
                                        // 6-digit extended year
              "(?:-(\\d{2})" + // optional month capture
              "(?:-(\\d{2})" + // optional day capture
              "(?:" + // capture hours:minutes:seconds.milliseconds
                  "T(\\d{2})" + // hours capture
                  ":(\\d{2})" + // minutes capture
                  "(?:" + // optional :seconds.milliseconds
                      ":(\\d{2})" + // seconds capture
                      "(?:(\\.\\d{1,}))?" + // milliseconds capture
                  ")?" +
              "(" + // capture UTC offset component
                  "Z|" + // UTC capture
                  "(?:" + // offset specifier +/-hours:minutes
                      "([-+])" + // sign capture
                      "(\\d{2})" + // hours offset capture
                      ":(\\d{2})" + // minutes offset capture
                  ")" +
              ")?)?)?)?" +
          "$");

          var months = [
              0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365
          ];

          function dayFromMonth(year, month) {
              var t = month > 1 ? 1 : 0;
              return (
                  months[month] +
                  Math.floor((year - 1969 + t) / 4) -
                  Math.floor((year - 1901 + t) / 100) +
                  Math.floor((year - 1601 + t) / 400) +
                  365 * (year - 1970)
              );
          }

          function toUTC(t) {
              return Number(new NativeDate(1970, 0, 1, 0, 0, 0, t));
          }

          // Copy any custom methods a 3rd party library may have added
          for (var key in NativeDate) {
              Date[key] = NativeDate[key];
          }

          // Copy "native" methods explicitly; they may be non-enumerable
          Date.now = NativeDate.now;
          Date.UTC = NativeDate.UTC;
          Date.prototype = NativeDate.prototype;
          Date.prototype.constructor = Date;

          // Upgrade Date.parse to handle simplified ISO 8601 strings
          Date.parse = function parse(string) {
              var match = isoDateExpression.exec(string);
              if (match) {
                  // parse months, days, hours, minutes, seconds, and milliseconds
                  // provide default values if necessary
                  // parse the UTC offset component
                  var year = Number(match[1]),
                      month = Number(match[2] || 1) - 1,
                      day = Number(match[3] || 1) - 1,
                      hour = Number(match[4] || 0),
                      minute = Number(match[5] || 0),
                      second = Number(match[6] || 0),
                      millisecond = Math.floor(Number(match[7] || 0) * 1000),
                      // When time zone is missed, local offset should be used
                      // (ES 5.1 bug)
                      // see https://bugs.ecmascript.org/show_bug.cgi?id=112
                      isLocalTime = Boolean(match[4] && !match[8]),
                      signOffset = match[9] === "-" ? 1 : -1,
                      hourOffset = Number(match[10] || 0),
                      minuteOffset = Number(match[11] || 0),
                      result;
                  if (
                      hour < (
                          minute > 0 || second > 0 || millisecond > 0 ?
                          24 : 25
                      ) &&
                      minute < 60 && second < 60 && millisecond < 1000 &&
                      month > -1 && month < 12 && hourOffset < 24 &&
                      minuteOffset < 60 && // detect invalid offsets
                      day > -1 &&
                      day < (
                          dayFromMonth(year, month + 1) -
                          dayFromMonth(year, month)
                      )
                  ) {
                      result = (
                          (dayFromMonth(year, month) + day) * 24 +
                          hour +
                          hourOffset * signOffset
                      ) * 60;
                      result = (
                          (result + minute + minuteOffset * signOffset) * 60 +
                          second
                      ) * 1000 + millisecond;
                      if (isLocalTime) {
                          result = toUTC(result);
                      }
                      if (-8.64e15 <= result && result <= 8.64e15) {
                          return result;
                      }
                  }
                  return NaN;
              }
              return NativeDate.parse.apply(this, arguments);
          };

          return Date;
      })(Date);
  }

  // ES5 15.9.4.4
  // http://es5.github.com/#x15.9.4.4
  if (!Date.now) {
      Date.now = function now() {
          return new Date().getTime();
      };
  }


  //
  // Number
  // ======
  //

  // ES5.1 15.7.4.5
  // http://es5.github.com/#x15.7.4.5
  var hasToFixedBugs = NumberPrototype.toFixed && (
    (0.00008).toFixed(3) !== '0.000'
    || (0.9).toFixed(0) !== '1'
    || (1.255).toFixed(2) !== '1.25'
    || (1000000000000000128).toFixed(0) !== "1000000000000000128"
  );

  var toFixedHelpers = {
    base: 1e7,
    size: 6,
    data: [0, 0, 0, 0, 0, 0],
    multiply: function multiply(n, c) {
        var i = -1;
        while (++i < toFixedHelpers.size) {
            c += n * toFixedHelpers.data[i];
            toFixedHelpers.data[i] = c % toFixedHelpers.base;
            c = Math.floor(c / toFixedHelpers.base);
        }
    },
    divide: function divide(n) {
        var i = toFixedHelpers.size, c = 0;
        while (--i >= 0) {
            c += toFixedHelpers.data[i];
            toFixedHelpers.data[i] = Math.floor(c / n);
            c = (c % n) * toFixedHelpers.base;
        }
    },
    numToString: function numToString() {
        var i = toFixedHelpers.size;
        var s = '';
        while (--i >= 0) {
            if (s !== '' || i === 0 || toFixedHelpers.data[i] !== 0) {
                var t = String(toFixedHelpers.data[i]);
                if (s === '') {
                    s = t;
                } else {
                    s += '0000000'.slice(0, 7 - t.length) + t;
                }
            }
        }
        return s;
    },
    pow: function pow(x, n, acc) {
        return (n === 0 ? acc : (n % 2 === 1 ? pow(x, n - 1, acc * x) : pow(x * x, n / 2, acc)));
    },
    log: function log(x) {
        var n = 0;
        while (x >= 4096) {
            n += 12;
            x /= 4096;
        }
        while (x >= 2) {
            n += 1;
            x /= 2;
        }
        return n;
    }
  };

  defineProperties(NumberPrototype, {
      toFixed: function toFixed(fractionDigits) {
          var f, x, s, m, e, z, j, k;

          // Test for NaN and round fractionDigits down
          f = Number(fractionDigits);
          f = f !== f ? 0 : Math.floor(f);

          if (f < 0 || f > 20) {
              throw new RangeError("Number.toFixed called with invalid number of decimals");
          }

          x = Number(this);

          // Test for NaN
          if (x !== x) {
              return "NaN";
          }

          // If it is too big or small, return the string value of the number
          if (x <= -1e21 || x >= 1e21) {
              return String(x);
          }

          s = "";

          if (x < 0) {
              s = "-";
              x = -x;
          }

          m = "0";

          if (x > 1e-21) {
              // 1e-21 < x < 1e21
              // -70 < log2(x) < 70
              e = toFixedHelpers.log(x * toFixedHelpers.pow(2, 69, 1)) - 69;
              z = (e < 0 ? x * toFixedHelpers.pow(2, -e, 1) : x / toFixedHelpers.pow(2, e, 1));
              z *= 0x10000000000000; // Math.pow(2, 52);
              e = 52 - e;

              // -18 < e < 122
              // x = z / 2 ^ e
              if (e > 0) {
                  toFixedHelpers.multiply(0, z);
                  j = f;

                  while (j >= 7) {
                      toFixedHelpers.multiply(1e7, 0);
                      j -= 7;
                  }

                  toFixedHelpers.multiply(toFixedHelpers.pow(10, j, 1), 0);
                  j = e - 1;

                  while (j >= 23) {
                      toFixedHelpers.divide(1 << 23);
                      j -= 23;
                  }

                  toFixedHelpers.divide(1 << j);
                  toFixedHelpers.multiply(1, 1);
                  toFixedHelpers.divide(2);
                  m = toFixedHelpers.numToString();
              } else {
                  toFixedHelpers.multiply(0, z);
                  toFixedHelpers.multiply(1 << (-e), 0);
                  m = toFixedHelpers.numToString() + '0.00000000000000000000'.slice(2, 2 + f);
              }
          }

          if (f > 0) {
              k = m.length;

              if (k <= f) {
                  m = s + '0.0000000000000000000'.slice(0, f - k + 2) + m;
              } else {
                  m = s + m.slice(0, k - f) + '.' + m.slice(k - f);
              }
          } else {
              m = s + m;
          }

          return m;
      }
  }, hasToFixedBugs);


  //
  // String
  // ======
  //

  // ES5 15.5.4.14
  // http://es5.github.com/#x15.5.4.14

  // [bugfix, IE lt 9, firefox 4, Konqueror, Opera, obscure browsers]
  // Many browsers do not split properly with regular expressions or they
  // do not perform the split correctly under obscure conditions.
  // See http://blog.stevenlevithan.com/archives/cross-browser-split
  // I've tested in many browsers and this seems to cover the deviant ones:
  //    'ab'.split(/(?:ab)*/) should be ["", ""], not [""]
  //    '.'.split(/(.?)(.?)/) should be ["", ".", "", ""], not ["", ""]
  //    'tesst'.split(/(s)*/) should be ["t", undefined, "e", "s", "t"], not
  //       [undefined, "t", undefined, "e", ...]
  //    ''.split(/.?/) should be [], not [""]
  //    '.'.split(/()()/) should be ["."], not ["", "", "."]

  var string_split = StringPrototype.split;
  if (
      'ab'.split(/(?:ab)*/).length !== 2 ||
      '.'.split(/(.?)(.?)/).length !== 4 ||
      'tesst'.split(/(s)*/)[1] === "t" ||
      'test'.split(/(?:)/, -1).length !== 4 ||
      ''.split(/.?/).length ||
      '.'.split(/()()/).length > 1
  ) {
      (function () {
          var compliantExecNpcg = /()??/.exec("")[1] === void 0; // NPCG: nonparticipating capturing group

          StringPrototype.split = function (separator, limit) {
              var string = this;
              if (separator === void 0 && limit === 0) {
                  return [];
              }

              // If `separator` is not a regex, use native split
              if (_toString.call(separator) !== "[object RegExp]") {
                  return string_split.call(this, separator, limit);
              }

              var output = [],
                  flags = (separator.ignoreCase ? "i" : "") +
                          (separator.multiline  ? "m" : "") +
                          (separator.extended   ? "x" : "") + // Proposed for ES6
                          (separator.sticky     ? "y" : ""), // Firefox 3+
                  lastLastIndex = 0,
                  // Make `global` and avoid `lastIndex` issues by working with a copy
                  separator2, match, lastIndex, lastLength;
              separator = new RegExp(separator.source, flags + "g");
              string += ""; // Type-convert
              if (!compliantExecNpcg) {
                  // Doesn't need flags gy, but they don't hurt
                  separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
              }
              /* Values for `limit`, per the spec:
               * If undefined: 4294967295 // Math.pow(2, 32) - 1
               * If 0, Infinity, or NaN: 0
               * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
               * If negative number: 4294967296 - Math.floor(Math.abs(limit))
               * If other: Type-convert, then use the above rules
               */
              limit = limit === void 0 ?
                  -1 >>> 0 : // Math.pow(2, 32) - 1
                  ToUint32(limit);
              while (match = separator.exec(string)) {
                  // `separator.lastIndex` is not reliable cross-browser
                  lastIndex = match.index + match[0].length;
                  if (lastIndex > lastLastIndex) {
                      output.push(string.slice(lastLastIndex, match.index));
                      // Fix browsers whose `exec` methods don't consistently return `undefined` for
                      // nonparticipating capturing groups
                      if (!compliantExecNpcg && match.length > 1) {
                          match[0].replace(separator2, function () {
                              for (var i = 1; i < arguments.length - 2; i++) {
                                  if (arguments[i] === void 0) {
                                      match[i] = void 0;
                                  }
                              }
                          });
                      }
                      if (match.length > 1 && match.index < string.length) {
                          ArrayPrototype.push.apply(output, match.slice(1));
                      }
                      lastLength = match[0].length;
                      lastLastIndex = lastIndex;
                      if (output.length >= limit) {
                          break;
                      }
                  }
                  if (separator.lastIndex === match.index) {
                      separator.lastIndex++; // Avoid an infinite loop
                  }
              }
              if (lastLastIndex === string.length) {
                  if (lastLength || !separator.test("")) {
                      output.push("");
                  }
              } else {
                  output.push(string.slice(lastLastIndex));
              }
              return output.length > limit ? output.slice(0, limit) : output;
          };
      }());

  // [bugfix, chrome]
  // If separator is undefined, then the result array contains just one String,
  // which is the this value (converted to a String). If limit is not undefined,
  // then the output array is truncated so that it contains no more than limit
  // elements.
  // "0".split(undefined, 0) -> []
  } else if ("0".split(void 0, 0).length) {
      StringPrototype.split = function split(separator, limit) {
          if (separator === void 0 && limit === 0) { return []; }
          return string_split.call(this, separator, limit);
      };
  }

  var str_replace = StringPrototype.replace;
  var replaceReportsGroupsCorrectly = (function () {
      var groups = [];
      'x'.replace(/x(.)?/g, function (match, group) {
          groups.push(group);
      });
      return groups.length === 1 && typeof groups[0] === 'undefined';
  }());

  if (!replaceReportsGroupsCorrectly) {
      StringPrototype.replace = function replace(searchValue, replaceValue) {
          var isFn = isFunction(replaceValue);
          var hasCapturingGroups = isRegex(searchValue) && (/\)[*?]/).test(searchValue.source);
          if (!isFn || !hasCapturingGroups) {
              return str_replace.call(this, searchValue, replaceValue);
          } else {
              var wrappedReplaceValue = function (match) {
                  var length = arguments.length;
                  var originalLastIndex = searchValue.lastIndex;
                  searchValue.lastIndex = 0;
                  var args = searchValue.exec(match);
                  searchValue.lastIndex = originalLastIndex;
                  args.push(arguments[length - 2], arguments[length - 1]);
                  return replaceValue.apply(this, args);
              };
              return str_replace.call(this, searchValue, wrappedReplaceValue);
          }
      };
  }

  // ECMA-262, 3rd B.2.3
  // Not an ECMAScript standard, although ECMAScript 3rd Edition has a
  // non-normative section suggesting uniform semantics and it should be
  // normalized across all browsers
  // [bugfix, IE lt 9] IE < 9 substr() with negative value not working in IE
  var string_substr = StringPrototype.substr;
  var hasNegativeSubstrBug = "".substr && "0b".substr(-1) !== "b";
  defineProperties(StringPrototype, {
      substr: function substr(start, length) {
          return string_substr.call(
              this,
              start < 0 ? ((start = this.length + start) < 0 ? 0 : start) : start,
              length
          );
      }
  }, hasNegativeSubstrBug);

  // ES5 15.5.4.20
  // whitespace from: http://es5.github.io/#x15.5.4.20
  var ws = "\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003" +
      "\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028" +
      "\u2029\uFEFF";
  var zeroWidth = '\u200b';
  var wsRegexChars = "[" + ws + "]";
  var trimBeginRegexp = new RegExp("^" + wsRegexChars + wsRegexChars + "*");
  var trimEndRegexp = new RegExp(wsRegexChars + wsRegexChars + "*$");
  var hasTrimWhitespaceBug = StringPrototype.trim && (ws.trim() || !zeroWidth.trim());
  defineProperties(StringPrototype, {
      // http://blog.stevenlevithan.com/archives/faster-trim-javascript
      // http://perfectionkills.com/whitespace-deviations/
      trim: function trim() {
          if (this === void 0 || this === null) {
              throw new TypeError("can't convert " + this + " to object");
          }
          return String(this).replace(trimBeginRegexp, "").replace(trimEndRegexp, "");
      }
  }, hasTrimWhitespaceBug);

  // ES-5 15.1.2.2
  if (parseInt(ws + '08') !== 8 || parseInt(ws + '0x16') !== 22) {
      parseInt = (function (origParseInt) {
          var hexRegex = /^0[xX]/;
          return function parseIntES5(str, radix) {
              str = String(str).trim();
              if (!Number(radix)) {
                  radix = hexRegex.test(str) ? 16 : 10;
              }
              return origParseInt(str, radix);
          };
      }(parseInt));
  }

  // ES5 Shams

  /*!
   * https://github.com/es-shims/es5-shim
   * @license es5-shim Copyright 2009-2014 by contributors, MIT License
   * see https://github.com/es-shims/es5-shim/blob/master/LICENSE
   */
  (function () {

  var call = Function.prototype.call;
  var prototypeOfObject = Object.prototype;
  var owns = call.bind(prototypeOfObject.hasOwnProperty);

  // If JS engine supports accessors creating shortcuts.
  var defineGetter;
  var defineSetter;
  var lookupGetter;
  var lookupSetter;
  var supportsAccessors = owns(prototypeOfObject, "__defineGetter__");
  if (supportsAccessors) {
      defineGetter = call.bind(prototypeOfObject.__defineGetter__);
      defineSetter = call.bind(prototypeOfObject.__defineSetter__);
      lookupGetter = call.bind(prototypeOfObject.__lookupGetter__);
      lookupSetter = call.bind(prototypeOfObject.__lookupSetter__);
  }

  // ES5 15.2.3.2
  // http://es5.github.com/#x15.2.3.2
  if (!Object.getPrototypeOf) {
      // https://github.com/es-shims/es5-shim/issues#issue/2
      // http://ejohn.org/blog/objectgetprototypeof/
      // recommended by fschaefer on github
      //
      // sure, and webreflection says ^_^
      // ... this will nerever possibly return null
      // ... Opera Mini breaks here with infinite loops
      Object.getPrototypeOf = function getPrototypeOf(object) {
          var proto = object.__proto__;
          if (proto || proto === null) {
              return proto;
          } else if (object.constructor) {
              return object.constructor.prototype;
          } else {
              return prototypeOfObject;
          }
      };
  }

  //ES5 15.2.3.3
  //http://es5.github.com/#x15.2.3.3

  function doesGetOwnPropertyDescriptorWork(object) {
      try {
          object.sentinel = 0;
          return Object.getOwnPropertyDescriptor(
                  object,
                  "sentinel"
          ).value === 0;
      } catch (exception) {
          // returns falsy
      }
  }

  //check whether getOwnPropertyDescriptor works if it's given. Otherwise,
  //shim partially.
  if (Object.defineProperty) {
      var getOwnPropertyDescriptorWorksOnObject = doesGetOwnPropertyDescriptorWork({});
      var getOwnPropertyDescriptorWorksOnDom = typeof document === "undefined" ||
      doesGetOwnPropertyDescriptorWork(document.createElement("div"));
      if (!getOwnPropertyDescriptorWorksOnDom || !getOwnPropertyDescriptorWorksOnObject) {
          var getOwnPropertyDescriptorFallback = Object.getOwnPropertyDescriptor;
      }
  }

  if (!Object.getOwnPropertyDescriptor || getOwnPropertyDescriptorFallback) {
      var ERR_NON_OBJECT = "Object.getOwnPropertyDescriptor called on a non-object: ";

      Object.getOwnPropertyDescriptor = function getOwnPropertyDescriptor(object, property) {
          if ((typeof object !== "object" && typeof object !== "function") || object === null) {
              throw new TypeError(ERR_NON_OBJECT + object);
          }

          // make a valiant attempt to use the real getOwnPropertyDescriptor
          // for I8's DOM elements.
          if (getOwnPropertyDescriptorFallback) {
              try {
                  return getOwnPropertyDescriptorFallback.call(Object, object, property);
              } catch (exception) {
                  // try the shim if the real one doesn't work
              }
          }

          // If object does not owns property return undefined immediately.
          if (!owns(object, property)) {
              return;
          }

          // If object has a property then it's for sure both `enumerable` and
          // `configurable`.
          var descriptor =  { enumerable: true, configurable: true };

          // If JS engine supports accessor properties then property may be a
          // getter or setter.
          if (supportsAccessors) {
              // Unfortunately `__lookupGetter__` will return a getter even
              // if object has own non getter property along with a same named
              // inherited getter. To avoid misbehavior we temporary remove
              // `__proto__` so that `__lookupGetter__` will return getter only
              // if it's owned by an object.
              var prototype = object.__proto__;
              var notPrototypeOfObject = object !== prototypeOfObject;
              // avoid recursion problem, breaking in Opera Mini when
              // Object.getOwnPropertyDescriptor(Object.prototype, 'toString')
              // or any other Object.prototype accessor
              if (notPrototypeOfObject) {
                  object.__proto__ = prototypeOfObject;
              }

              var getter = lookupGetter(object, property);
              var setter = lookupSetter(object, property);

              if (notPrototypeOfObject) {
                  // Once we have getter and setter we can put values back.
                  object.__proto__ = prototype;
              }

              if (getter || setter) {
                  if (getter) {
                      descriptor.get = getter;
                  }
                  if (setter) {
                      descriptor.set = setter;
                  }
                  // If it was accessor property we're done and return here
                  // in order to avoid adding `value` to the descriptor.
                  return descriptor;
              }
          }

          // If we got this far we know that object has an own property that is
          // not an accessor so we set it as a value and return descriptor.
          descriptor.value = object[property];
          descriptor.writable = true;
          return descriptor;
      };
  }

  // ES5 15.2.3.4
  // http://es5.github.com/#x15.2.3.4
  if (!Object.getOwnPropertyNames) {
      Object.getOwnPropertyNames = function getOwnPropertyNames(object) {
          return Object.keys(object);
      };
  }

  // ES5 15.2.3.5
  // http://es5.github.com/#x15.2.3.5
  if (!Object.create) {

      // Contributed by Brandon Benvie, October, 2012
      var createEmpty;
      var supportsProto = !({__proto__:null} instanceof Object);
                          // the following produces false positives
                          // in Opera Mini => not a reliable check
                          // Object.prototype.__proto__ === null
      if (supportsProto || typeof document === 'undefined') {
          createEmpty = function () {
              return { "__proto__": null };
          };
      } else {
          // In old IE __proto__ can't be used to manually set `null`, nor does
          // any other method exist to make an object that inherits from nothing,
          // aside from Object.prototype itself. Instead, create a new global
          // object and *steal* its Object.prototype and strip it bare. This is
          // used as the prototype to create nullary objects.
          createEmpty = function () {
              var iframe = document.createElement('iframe');
              var parent = document.body || document.documentElement;
              iframe.style.display = 'none';
              parent.appendChild(iframe);
              iframe.src = 'javascript:';
              var empty = iframe.contentWindow.Object.prototype;
              parent.removeChild(iframe);
              iframe = null;
              delete empty.constructor;
              delete empty.hasOwnProperty;
              delete empty.propertyIsEnumerable;
              delete empty.isPrototypeOf;
              delete empty.toLocaleString;
              delete empty.toString;
              delete empty.valueOf;
              empty.__proto__ = null;

              function Empty() {}
              Empty.prototype = empty;
              // short-circuit future calls
              createEmpty = function () {
                  return new Empty();
              };
              return new Empty();
          };
      }

      Object.create = function create(prototype, properties) {

          var object;
          function Type() {}  // An empty constructor.

          if (prototype === null) {
              object = createEmpty();
          } else {
              if (typeof prototype !== "object" && typeof prototype !== "function") {
                  // In the native implementation `parent` can be `null`
                  // OR *any* `instanceof Object`  (Object|Function|Array|RegExp|etc)
                  // Use `typeof` tho, b/c in old IE, DOM elements are not `instanceof Object`
                  // like they are in modern browsers. Using `Object.create` on DOM elements
                  // is...err...probably inappropriate, but the native version allows for it.
                  throw new TypeError("Object prototype may only be an Object or null"); // same msg as Chrome
              }
              Type.prototype = prototype;
              object = new Type();
              // IE has no built-in implementation of `Object.getPrototypeOf`
              // neither `__proto__`, but this manually setting `__proto__` will
              // guarantee that `Object.getPrototypeOf` will work as expected with
              // objects created using `Object.create`
              object.__proto__ = prototype;
          }

          if (properties !== void 0) {
              Object.defineProperties(object, properties);
          }

          return object;
      };
  }

  // ES5 15.2.3.6
  // http://es5.github.com/#x15.2.3.6

  // Patch for WebKit and IE8 standard mode
  // Designed by hax <hax.github.com>
  // related issue: https://github.com/es-shims/es5-shim/issues#issue/5
  // IE8 Reference:
  //     http://msdn.microsoft.com/en-us/library/dd282900.aspx
  //     http://msdn.microsoft.com/en-us/library/dd229916.aspx
  // WebKit Bugs:
  //     https://bugs.webkit.org/show_bug.cgi?id=36423

  function doesDefinePropertyWork(object) {
      try {
          Object.defineProperty(object, "sentinel", {});
          return "sentinel" in object;
      } catch (exception) {
          // returns falsy
      }
  }

  // check whether defineProperty works if it's given. Otherwise,
  // shim partially.
  if (Object.defineProperty) {
      var definePropertyWorksOnObject = doesDefinePropertyWork({});
      var definePropertyWorksOnDom = typeof document === "undefined" ||
          doesDefinePropertyWork(document.createElement("div"));
      if (!definePropertyWorksOnObject || !definePropertyWorksOnDom) {
          var definePropertyFallback = Object.defineProperty,
              definePropertiesFallback = Object.defineProperties;
      }
  }

  if (!Object.defineProperty || definePropertyFallback) {
      var ERR_NON_OBJECT_DESCRIPTOR = "Property description must be an object: ";
      var ERR_NON_OBJECT_TARGET = "Object.defineProperty called on non-object: "
      var ERR_ACCESSORS_NOT_SUPPORTED = "getters & setters can not be defined " +
                                        "on this javascript engine";

      Object.defineProperty = function defineProperty(object, property, descriptor) {
          if ((typeof object !== "object" && typeof object !== "function") || object === null) {
              throw new TypeError(ERR_NON_OBJECT_TARGET + object);
          }
          if ((typeof descriptor !== "object" && typeof descriptor !== "function") || descriptor === null) {
              throw new TypeError(ERR_NON_OBJECT_DESCRIPTOR + descriptor);
          }
          // make a valiant attempt to use the real defineProperty
          // for I8's DOM elements.
          if (definePropertyFallback) {
              try {
                  return definePropertyFallback.call(Object, object, property, descriptor);
              } catch (exception) {
                  // try the shim if the real one doesn't work
              }
          }

          // If it's a data property.
          if (owns(descriptor, "value")) {
              // fail silently if "writable", "enumerable", or "configurable"
              // are requested but not supported
              /*
              // alternate approach:
              if ( // can't implement these features; allow false but not true
                  !(owns(descriptor, "writable") ? descriptor.writable : true) ||
                  !(owns(descriptor, "enumerable") ? descriptor.enumerable : true) ||
                  !(owns(descriptor, "configurable") ? descriptor.configurable : true)
              )
                  throw new RangeError(
                      "This implementation of Object.defineProperty does not " +
                      "support configurable, enumerable, or writable."
                  );
              */

              if (supportsAccessors && (lookupGetter(object, property) ||
                                        lookupSetter(object, property)))
              {
                  // As accessors are supported only on engines implementing
                  // `__proto__` we can safely override `__proto__` while defining
                  // a property to make sure that we don't hit an inherited
                  // accessor.
                  var prototype = object.__proto__;
                  object.__proto__ = prototypeOfObject;
                  // Deleting a property anyway since getter / setter may be
                  // defined on object itself.
                  delete object[property];
                  object[property] = descriptor.value;
                  // Setting original `__proto__` back now.
                  object.__proto__ = prototype;
              } else {
                  object[property] = descriptor.value;
              }
          } else {
              if (!supportsAccessors) {
                  throw new TypeError(ERR_ACCESSORS_NOT_SUPPORTED);
              }
              // If we got that far then getters and setters can be defined !!
              if (owns(descriptor, "get")) {
                  defineGetter(object, property, descriptor.get);
              }
              if (owns(descriptor, "set")) {
                  defineSetter(object, property, descriptor.set);
              }
          }
          return object;
      };
  }

  // ES5 15.2.3.7
  // http://es5.github.com/#x15.2.3.7
  if (!Object.defineProperties || definePropertiesFallback) {
      Object.defineProperties = function defineProperties(object, properties) {
          // make a valiant attempt to use the real defineProperties
          if (definePropertiesFallback) {
              try {
                  return definePropertiesFallback.call(Object, object, properties);
              } catch (exception) {
                  // try the shim if the real one doesn't work
              }
          }

          for (var property in properties) {
              if (owns(properties, property) && property !== "__proto__") {
                  Object.defineProperty(object, property, properties[property]);
              }
          }
          return object;
      };
  }

  // ES5 15.2.3.8
  // http://es5.github.com/#x15.2.3.8
  if (!Object.seal) {
      Object.seal = function seal(object) {
          // this is misleading and breaks feature-detection, but
          // allows "securable" code to "gracefully" degrade to working
          // but insecure code.
          return object;
      };
  }

  // ES5 15.2.3.9
  // http://es5.github.com/#x15.2.3.9
  if (!Object.freeze) {
      Object.freeze = function freeze(object) {
          // this is misleading and breaks feature-detection, but
          // allows "securable" code to "gracefully" degrade to working
          // but insecure code.
          return object;
      };
  }

  // detect a Rhino bug and patch it
  try {
      Object.freeze(function () {});
  } catch (exception) {
      Object.freeze = (function freeze(freezeObject) {
          return function freeze(object) {
              if (typeof object === "function") {
                  return object;
              } else {
                  return freezeObject(object);
              }
          };
      })(Object.freeze);
  }

  // ES5 15.2.3.10
  // http://es5.github.com/#x15.2.3.10
  if (!Object.preventExtensions) {
      Object.preventExtensions = function preventExtensions(object) {
          // this is misleading and breaks feature-detection, but
          // allows "securable" code to "gracefully" degrade to working
          // but insecure code.
          return object;
      };
  }

  // ES5 15.2.3.11
  // http://es5.github.com/#x15.2.3.11
  if (!Object.isSealed) {
      Object.isSealed = function isSealed(object) {
          return false;
      };
  }

  // ES5 15.2.3.12
  // http://es5.github.com/#x15.2.3.12
  if (!Object.isFrozen) {
      Object.isFrozen = function isFrozen(object) {
          return false;
      };
  }

  // ES5 15.2.3.13
  // http://es5.github.com/#x15.2.3.13
  if (!Object.isExtensible) {
      Object.isExtensible = function isExtensible(object) {
          // 1. If Type(O) is not Object throw a TypeError exception.
          if (Object(object) !== object) {
              throw new TypeError(); // TODO message
          }
          // 2. Return the Boolean value of the [[Extensible]] internal property of O.
          var name = '';
          while (owns(object, name)) {
              name += '?';
          }
          object[name] = true;
          var returnValue = owns(object, name);
          delete object[name];
          return returnValue;
      };
  }

  })();
})();

/*
 * Console-polyfill. MIT license.
 * https://github.com/paulmillr/console-polyfill
 * Make it safe to do console.log() always.
 */
(function(global) {
  
  global.console = global.console || {};
  var con = global.console;
  var prop, method;
  var empty = {};
  var dummy = function() {};
  var properties = 'memory'.split(',');
  var methods = ('assert,clear,count,debug,dir,dirxml,error,exception,group,' +
     'groupCollapsed,groupEnd,info,log,markTimeline,profile,profiles,profileEnd,' +
     'show,table,time,timeEnd,timeline,timelineEnd,timeStamp,trace,warn').split(',');
  while (prop = properties.pop()) if (!con[prop]) con[prop] = empty;
  while (method = methods.pop()) if (!con[method]) con[method] = dummy;
})(typeof window === 'undefined' ? this : window);
// Using `this` for web workers while maintaining compatibility with browser
// targeted script loaders such as Browserify or Webpack where the only way to
// get to the global object is via `window`.

/*
 * *Very incomplete* ES6 shims
 */
(function() {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
  // WEB-23440 IE7,8 do not support Object.defineProperty, modified shim accordingly
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
      position = position || 0;
      return this.indexOf(searchString, position) === position;
    };
  }

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
  // WEB-23440 IE7,8 do not support Object.defineProperty, modified shim accordingly
  if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(searchString, position) {
      position = position || this.length;
      position = position - searchString.length;
      var lastIndex = this.lastIndexOf(searchString);
      return lastIndex !== -1 && lastIndex === position;
    };
  }

})();

// Register that es5 and 6 shims have been loaded with requirejs
define('es6', [],function(){});

/**
 * A message queue which allows subscribing to message topics and publishing
 * messages to those topics.There may be any number of unique queues, and
 * subscribing/ publishing will be local to that queue.
 */
define('message-queue',[ 'jquery', 'preconditions', 'es6' ], function($, preconditions) {

  /**
   * Constructor function for the message queue.
   */
  var MQ = function() {
  }
  
  MQ.prototype = {
    _handlersByTopic : {},

    _invokeHandlers : function(topic, message) {
      var self = this;
      var handlers = self._handlersByTopic[topic];
        // 
      if (handlers) {
        handlers.forEach(function(handler) {
          // TODO: handle exceptions to make sure a failing handler
          // doesn't break the chain?
          handler(message);
        });
      }
    },

    /**
     * Publish a message to a topic.
     *
     * @param topic The topic to publish the message to
     * @param message The message to publish 
     */
    publish : function(topic, message) {
      preconditions.assertIsString(topic);
      preconditions.assertIsNotNull(message);
      var self = this;
      self._invokeHandlers(topic, message);
    },

    /**
     * Subscribe to receive notifications for a topic 
     * Events published to the topic will be passed
     * to the provided handler.
     *
     * @param topic The topic to subscribe to messages on
     */
    subscribe : function(topic, handler) {
      preconditions.assertIsString(topic);
      preconditions.assertIsFunction(handler);
      var self = this;
      self._handlersByTopic[topic] = self._handlersByTopic[topic] || [];
      self._handlersByTopic[topic].push(handler);
    }
  };

  return MQ;
});


/**
 * An inter-window message queue which allows subscribing to message topics and
 * publishing messages to those topics that can be recieved in any window of the
 * current browser.
 *
 * The inter-window message queue is a singleton per window, as local storage
 * change events cannot be scoped to a particular object in other windows.
 */
define('interwindow-message-queue',[ 'jquery', 'message-queue', 'preconditions', 'local-storage', 'es6' ],
    function($, MessageQueue, preconditions, localStorage) {

  var LOCAL_STORAGE_PREFIX = 'ENMQ_';

  var interWindowMessageQueue = {
    _mq : new MessageQueue(),

    _handleInterWindowMessage : function(storageEvent) {
        var self = this;
        preconditions.assertIsNotNull(storageEvent);
        if (storageEvent.newValue == null) {
          // storage events are only fired when the value changes, so each time
          // we want to add an event to a topic, we first clear the current
          // value. Ignore those refresh events
          return;
        }
        if (storageEvent.key.indexOf(LOCAL_STORAGE_PREFIX) != 0) {
          // this isn't one of our topics, ignore
          return;
        }
        var topic = storageEvent.key.substring(LOCAL_STORAGE_PREFIX.length);
        var message = storageEvent.newValue;

        try {
          message = JSON.parse(message);
        } catch (e) {
          // Not parseable to JSON, pass on the string value
        }

        self._mq._invokeHandlers(topic, message);
    },

    /**
     * Publish a message to a topic.
     *
     * @param topic The topic to publish the message to
     * @param message The message to publish. This must be either a String or
     *                an object that can be serialized to JSON.
     * @param publishToCurrentWindow  Whether to notify subscribers in this window
     */
    publish : function(topic, message, publishToCurrentWindow) {
      preconditions.assertIsString(topic);
      preconditions.assertIsNotNull(message);
      var self = this;

      var key = LOCAL_STORAGE_PREFIX + topic;
      var serializedMessage = message;

      if (typeof message === 'object') {
        serializedMessage = JSON.stringify(message);
      } else if (typeof message !== 'string') {
        throw new Error("Messages must be either serializable objects or strings");
      }

      // storage events are only fired when the value changes, so each time
      // we want to add an event to a topic, we first clear the current
      // value
      localStorage.removeItem(key);
      localStorage.setItem(key, serializedMessage);

      if (publishToCurrentWindow) {
        self._mq.publish(topic, message);
      }
    },

    subscribe : function(topic, handler) {
      var self = this;
      self._mq.subscribe(topic, handler);
    },

    /**
     * Get the last message published to a topic. May return undefined if no
     * messages have been sent to the given topic.
     */
    peek : function(topic) {
      var key = LOCAL_STORAGE_PREFIX + topic;
      return localStorage.getItem(key);
    }
  };

  // set up the storage change event handler
  $(window).bind('storage', function(storageEvent) {
    interWindowMessageQueue._handleInterWindowMessage(storageEvent.originalEvent);
  });

  return interWindowMessageQueue;
});

/**
 * Utility functions for converting between strings and array buffers
 *
 * From https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#Appendix.3A_Decode_a_Base64_string_to_Uint8Array_or_ArrayBuffer
 */
define('binary-utils',[], function() {
  /*\
  |*|
  |*|  Base64 / binary data / UTF-8 strings utilities
  |*|
  |*|  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
  |*|
  \*/

  /* Array of bytes to base64 string decoding */

  function b64ToUint6 (nChr) {

    return nChr > 64 && nChr < 91 ?
        nChr - 65
      : nChr > 96 && nChr < 123 ?
        nChr - 71
      : nChr > 47 && nChr < 58 ?
        nChr + 4
      : nChr === 43 ?
        62
      : nChr === 47 ?
        63
      :
        0;

  }

  function base64DecToArr (sBase64, nBlocksSize) {

    var
      sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
      nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2, taBytes = new Uint8Array(nOutLen);

    for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
      nMod4 = nInIdx & 3;
      nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
      if (nMod4 === 3 || nInLen - nInIdx === 1) {
        for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
          taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
        }
        nUint24 = 0;

      }
    }

    return taBytes;
  }

  /* Base64 string to array encoding */

  function uint6ToB64 (nUint6) {

    return nUint6 < 26 ?
        nUint6 + 65
      : nUint6 < 52 ?
        nUint6 + 71
      : nUint6 < 62 ?
        nUint6 - 4
      : nUint6 === 62 ?
        43
      : nUint6 === 63 ?
        47
      :
        65;

  }

  function base64EncArr (aBytes) {

    var nMod3 = 2, sB64Enc = "";

    for (var nLen = aBytes.length, nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
      nMod3 = nIdx % 3;
      if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0) { sB64Enc += "\r\n"; }
      nUint24 |= aBytes[nIdx] << (16 >>> nMod3 & 24);
      if (nMod3 === 2 || aBytes.length - nIdx === 1) {
        sB64Enc += String.fromCharCode(uint6ToB64(nUint24 >>> 18 & 63), uint6ToB64(nUint24 >>> 12 & 63), uint6ToB64(nUint24 >>> 6 & 63), uint6ToB64(nUint24 & 63));
        nUint24 = 0;
      }
    }

    return sB64Enc.substr(0, sB64Enc.length - 2 + nMod3) + (nMod3 === 2 ? '' : nMod3 === 1 ? '=' : '==');

  }

  /* UTF-8 array to DOMString and vice versa */

  function UTF8ArrToStr (aBytes) {

    var sView = "";

    for (var nPart, nLen = aBytes.length, nIdx = 0; nIdx < nLen; nIdx++) {
      nPart = aBytes[nIdx];
      sView += String.fromCharCode(
        nPart > 251 && nPart < 254 && nIdx + 5 < nLen ? /* six bytes */
          /* (nPart - 252 << 30) may be not so safe in ECMAScript! So...: */
          (nPart - 252) * 1073741824 + (aBytes[++nIdx] - 128 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
        : nPart > 247 && nPart < 252 && nIdx + 4 < nLen ? /* five bytes */
          (nPart - 248 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
        : nPart > 239 && nPart < 248 && nIdx + 3 < nLen ? /* four bytes */
          (nPart - 240 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
        : nPart > 223 && nPart < 240 && nIdx + 2 < nLen ? /* three bytes */
          (nPart - 224 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
        : nPart > 191 && nPart < 224 && nIdx + 1 < nLen ? /* two bytes */
          (nPart - 192 << 6) + aBytes[++nIdx] - 128
        : /* nPart < 127 ? */ /* one byte */
          nPart
      );
    }

    return sView;

  }

  function strToUTF8Arr (sDOMStr) {

    var aBytes, nChr, nStrLen = sDOMStr.length, nArrLen = 0;

    /* mapping... */

    for (var nMapIdx = 0; nMapIdx < nStrLen; nMapIdx++) {
      nChr = sDOMStr.charCodeAt(nMapIdx);
      nArrLen += nChr < 0x80 ? 1 : nChr < 0x800 ? 2 : nChr < 0x10000 ? 3 : nChr < 0x200000 ? 4 : nChr < 0x4000000 ? 5 : 6;
    }

    aBytes = new Uint8Array(nArrLen);

    /* transcription... */

    for (var nIdx = 0, nChrIdx = 0; nIdx < nArrLen; nChrIdx++) {
      nChr = sDOMStr.charCodeAt(nChrIdx);
      if (nChr < 128) {
        /* one byte */
        aBytes[nIdx++] = nChr;
      } else if (nChr < 0x800) {
        /* two bytes */
        aBytes[nIdx++] = 192 + (nChr >>> 6);
        aBytes[nIdx++] = 128 + (nChr & 63);
      } else if (nChr < 0x10000) {
        /* three bytes */
        aBytes[nIdx++] = 224 + (nChr >>> 12);
        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
        aBytes[nIdx++] = 128 + (nChr & 63);
      } else if (nChr < 0x200000) {
        /* four bytes */
        aBytes[nIdx++] = 240 + (nChr >>> 18);
        aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
        aBytes[nIdx++] = 128 + (nChr & 63);
      } else if (nChr < 0x4000000) {
        /* five bytes */
        aBytes[nIdx++] = 248 + (nChr >>> 24);
        aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
        aBytes[nIdx++] = 128 + (nChr & 63);
      } else /* if (nChr <= 0x7fffffff) */ {
        /* six bytes */
        aBytes[nIdx++] = 252 + (nChr >>> 30);
        aBytes[nIdx++] = 128 + (nChr >>> 24 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
        aBytes[nIdx++] = 128 + (nChr & 63);
      }
    }

    return aBytes;

  }
  return {
    base64StringToUint8Arr : base64DecToArr,
    uint8ArrToBase64Str : base64EncArr,
    utf8ArrToStr : UTF8ArrToStr,
    strToUTF8Arr : strToUTF8Arr
  }
});

//
// Autogenerated by Thrift Compiler (0.5.0-en-exported)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//


define ('Limits',['require','thrift'],function (require) {

  // Define types and services

  var Thrift = require('thrift');
  var exports = exports || {};


  exports.EDAM_ATTRIBUTE_LEN_MIN = 1;

  exports.EDAM_ATTRIBUTE_LEN_MAX = 4096;

  exports.EDAM_ATTRIBUTE_REGEX = '^[^\p{Cc}\p{Zl}\p{Zp}]{1,4096}$';

  exports.EDAM_ATTRIBUTE_LIST_MAX = 100;

  exports.EDAM_ATTRIBUTE_MAP_MAX = 100;

  exports.EDAM_GUID_LEN_MIN = 36;

  exports.EDAM_GUID_LEN_MAX = 36;

  exports.EDAM_GUID_REGEX = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  exports.EDAM_EMAIL_LEN_MIN = 6;

  exports.EDAM_EMAIL_LEN_MAX = 255;

  exports.EDAM_EMAIL_LOCAL_REGEX = '^[A-Za-z0-9!#$%&\'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&\'*+/=?^_`{|}~-]+)*$';

  exports.EDAM_EMAIL_DOMAIN_REGEX = '^[A-Za-z0-9-]*[A-Za-z0-9](\.[A-Za-z0-9-]*[A-Za-z0-9])*\.([A-Za-z]{2,})$';

  exports.EDAM_EMAIL_REGEX = '^[A-Za-z0-9!#$%&\'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&\'*+/=?^_`{|}~-]+)*@[A-Za-z0-9-]*[A-Za-z0-9](\.[A-Za-z0-9-]*[A-Za-z0-9])*\.([A-Za-z]{2,})$';

  exports.EDAM_VAT_REGEX = '^(AT)?U[0-9]{8}$|^(BE)?0?[0-9]{9}$|^(BG)?[0-9]{9,10}$|^(CY)?[0-9]{8}L$|^(CZ)?[0-9]{8,10}$|^(DE)?[0-9]{9}$|^(DK)?[0-9]{8}$|^(EE)?[0-9]{9}$|^(EL|GR)?[0-9]{9}$|^(ES)?[0-9A-Z][0-9]{7}[0-9A-Z]$|^(FI)?[0-9]{8}$|^(FR)?[0-9A-Z]{2}[0-9]{9}$|^(GB)?([0-9]{9}([0-9]{3})?|[A-Z]{2}[0-9]{3})$|^(HU)?[0-9]{8}$|^(IE)?[0-9]S[0-9]{5}L$|^(IT)?[0-9]{11}$|^(LT)?([0-9]{9}|[0-9]{12})$|^(LU)?[0-9]{8}$|^(LV)?[0-9]{11}$|^(MT)?[0-9]{8}$|^(NL)?[0-9]{9}B[0-9]{2}$|^(PL)?[0-9]{10}$|^(PT)?[0-9]{9}$|^(RO)?[0-9]{2,10}$|^(SE)?[0-9]{12}$|^(SI)?[0-9]{8}$|^(SK)?[0-9]{10}$|^[0-9]{9}MVA$|^[0-9]{6}$|^CHE[0-9]{9}(TVA|MWST|IVA)$';

  exports.EDAM_TIMEZONE_LEN_MIN = 1;

  exports.EDAM_TIMEZONE_LEN_MAX = 32;

  exports.EDAM_TIMEZONE_REGEX = '^([A-Za-z_-]+(/[A-Za-z_-]+)*)|(GMT(-|\+)[0-9]{1,2}(:[0-9]{2})?)$';

  exports.EDAM_MIME_LEN_MIN = 3;

  exports.EDAM_MIME_LEN_MAX = 255;

  exports.EDAM_MIME_REGEX = '^[A-Za-z]+/[A-Za-z0-9._+-]+$';

  exports.EDAM_MIME_TYPE_GIF = 'image/gif';

  exports.EDAM_MIME_TYPE_JPEG = 'image/jpeg';

  exports.EDAM_MIME_TYPE_PNG = 'image/png';

  exports.EDAM_MIME_TYPE_TIFF = 'image/tiff';

  exports.EDAM_MIME_TYPE_WAV = 'audio/wav';

  exports.EDAM_MIME_TYPE_MP3 = 'audio/mpeg';

  exports.EDAM_MIME_TYPE_AMR = 'audio/amr';

  exports.EDAM_MIME_TYPE_AAC = 'audio/aac';

  exports.EDAM_MIME_TYPE_M4A = 'audio/mp4';

  exports.EDAM_MIME_TYPE_MP4_VIDEO = 'video/mp4';

  exports.EDAM_MIME_TYPE_INK = 'application/vnd.evernote.ink';

  exports.EDAM_MIME_TYPE_PDF = 'application/pdf';

  exports.EDAM_MIME_TYPE_DEFAULT = 'application/octet-stream';

  exports.EDAM_MIME_TYPES = ['image/gif','image/jpeg','image/png','audio/wav','audio/mpeg','audio/amr','application/vnd.evernote.ink','application/pdf','video/mp4','audio/aac','audio/mp4'];

  exports.EDAM_INDEXABLE_RESOURCE_MIME_TYPES = ['application/msword','application/mspowerpoint','application/excel','application/vnd.ms-word','application/vnd.ms-powerpoint','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.apple.pages','application/vnd.apple.numbers','application/vnd.apple.keynote','application/x-iwork-pages-sffpages','application/x-iwork-numbers-sffnumbers','application/x-iwork-keynote-sffkey'];

  exports.EDAM_COMMERCE_SERVICE_EVERNOTE = 'Evernote';

  exports.EDAM_COMMERCE_SERVICE_GOOGLE = 'Google';

  exports.EDAM_COMMERCE_SERVICE_PAYPAL = 'Paypal';

  exports.EDAM_COMMERCE_SERVICE_GIFT = 'Gift';

  exports.EDAM_COMMERCE_SERVICE_TRIALPAY = 'TrialPay';

  exports.EDAM_COMMERCE_SERVICE_TRIAL = 'Trial';

  exports.EDAM_COMMERCE_SERVICE_GROUP = 'Group';

  exports.EDAM_COMMERCE_SERVICE_BUNDLE = 'Bundle';

  exports.EDAM_COMMERCE_SERVICE_POINTS = 'Points';

  exports.EDAM_COMMERCE_SERVICE_CYBERSOURCE = 'CYBERSRC';

  exports.EDAM_COMMERCE_SERVICE_ANDROID = 'ANDROID';

  exports.EDAM_COMMERCE_SERVICE_AMAZON = 'AMAZON';

  exports.EDAM_COMMERCE_SERVICE_IPHONE = 'ITUNES';

  exports.EDAM_COMMERCE_SERVICE_IPHONE_SKITCH = 'ITUNES_S';

  exports.EDAM_COMMERCE_SERVICE_MAC = 'ITUNES_X';

  exports.EDAM_COMMERCE_SERVICE_BLACKBERRY = 'BB_WORLD';

  exports.EDAM_COMMERCE_SERVICE_BUSINESS = 'BUSINESS';

  exports.EDAM_COMMERCE_SERVICE_VAULT_CC_ADYEN = 'Biz-CC';

  exports.EDAM_COMMERCE_SERVICE_VAULT_CC_CYBERSOURCE = 'BIZ_CYB';

  exports.EDAM_COMMERCE_SERVICE_VAULT_INVOICE = 'Biz-INV';

  exports.EDAM_COMMERCE_SERVICE_VAULT_TRANSFER = 'TRANSFER';

  exports.EDAM_COMMERCE_SERVICE_ADYEN_ALIPAY = 'ALIPAY';

  exports.EDAM_COMMERCE_SERVICE_ADYEN_BOKU = 'ADY_BOKU';

  exports.EDAM_COMMERCE_SERVICE_ADYEN_CREDITCARD = 'ADYEN_CC';

  exports.EDAM_COMMERCE_SERVICE_ADYEN_PAYPAL = 'ADYEN_PP';

  exports.EDAM_COMMERCE_SERVICE_CASH_ON_DELIVERY = 'COD';

  exports.EDAM_COMMERCE_SERVICE_REPLACEMENT = 'REPL';

  exports.EDAM_COMMERCE_SERVICE_RESELLER = 'RESELLER';

  exports.EDAM_COMMERCE_SERVICE_FRIEND_REFERRAL = 'FRND_REF';

  exports.EDAM_COMMERCE_DEFAULT_CURRENCY_COUNTRY_CODE = 'USD';

  exports.EDAM_SEARCH_QUERY_LEN_MIN = 0;

  exports.EDAM_SEARCH_QUERY_LEN_MAX = 1024;

  exports.EDAM_SEARCH_QUERY_REGEX = '^[^\p{Cc}\p{Zl}\p{Zp}]{0,1024}$';

  exports.EDAM_HASH_LEN = 16;

  exports.EDAM_USER_USERNAME_LEN_MIN = 1;

  exports.EDAM_USER_USERNAME_LEN_MAX = 64;

  exports.EDAM_USER_USERNAME_REGEX = '^[a-z0-9]([a-z0-9_-]{0,62}[a-z0-9])?$';

  exports.EDAM_USER_NAME_LEN_MIN = 1;

  exports.EDAM_USER_NAME_LEN_MAX = 255;

  exports.EDAM_USER_NAME_REGEX = '^[^\p{Cc}\p{Zl}\p{Zp}]{1,255}$';

  exports.EDAM_TAG_NAME_LEN_MIN = 1;

  exports.EDAM_TAG_NAME_LEN_MAX = 100;

  exports.EDAM_TAG_NAME_REGEX = '^[^,\p{Cc}\p{Z}]([^,\p{Cc}\p{Zl}\p{Zp}]{0,98}[^,\p{Cc}\p{Z}])?$';

  exports.EDAM_NOTE_TITLE_LEN_MIN = 1;

  exports.EDAM_NOTE_TITLE_LEN_MAX = 255;

  exports.EDAM_NOTE_TITLE_REGEX = '^[^\p{Cc}\p{Z}]([^\p{Cc}\p{Zl}\p{Zp}]{0,253}[^\p{Cc}\p{Z}])?$';

  exports.EDAM_NOTE_CONTENT_LEN_MIN = 0;

  exports.EDAM_NOTE_CONTENT_LEN_MAX = 5242880;

  exports.EDAM_APPLICATIONDATA_NAME_LEN_MIN = 3;

  exports.EDAM_APPLICATIONDATA_NAME_LEN_MAX = 32;

  exports.EDAM_APPLICATIONDATA_VALUE_LEN_MIN = 0;

  exports.EDAM_APPLICATIONDATA_VALUE_LEN_MAX = 4092;

  exports.EDAM_APPLICATIONDATA_ENTRY_LEN_MAX = 4095;

  exports.EDAM_APPLICATIONDATA_NAME_REGEX = '^[A-Za-z0-9_.-]{3,32}$';

  exports.EDAM_APPLICATIONDATA_VALUE_REGEX = '^[\p{Space}[^\p{Cc}]]{0,4092}$';

  exports.EDAM_NOTEBOOK_NAME_LEN_MIN = 1;

  exports.EDAM_NOTEBOOK_NAME_LEN_MAX = 100;

  exports.EDAM_NOTEBOOK_NAME_REGEX = '^[^\p{Cc}\p{Z}]([^\p{Cc}\p{Zl}\p{Zp}]{0,98}[^\p{Cc}\p{Z}])?$';

  exports.EDAM_NOTEBOOK_STACK_LEN_MIN = 1;

  exports.EDAM_NOTEBOOK_STACK_LEN_MAX = 100;

  exports.EDAM_NOTEBOOK_STACK_REGEX = '^[^\p{Cc}\p{Z}]([^\p{Cc}\p{Zl}\p{Zp}]{0,98}[^\p{Cc}\p{Z}])?$';

  exports.EDAM_PUBLISHING_URI_LEN_MIN = 1;

  exports.EDAM_PUBLISHING_URI_LEN_MAX = 255;

  exports.EDAM_PUBLISHING_URI_REGEX = '^[a-zA-Z0-9.~_+-]{1,255}$';

  exports.EDAM_PUBLISHING_URI_PROHIBITED = ['.','..'];

  exports.EDAM_PUBLISHING_DESCRIPTION_LEN_MIN = 1;

  exports.EDAM_PUBLISHING_DESCRIPTION_LEN_MAX = 200;

  exports.EDAM_PUBLISHING_DESCRIPTION_REGEX = '^[^\p{Cc}\p{Z}]([^\p{Cc}\p{Zl}\p{Zp}]{0,198}[^\p{Cc}\p{Z}])?$';

  exports.EDAM_SAVED_SEARCH_NAME_LEN_MIN = 1;

  exports.EDAM_SAVED_SEARCH_NAME_LEN_MAX = 100;

  exports.EDAM_SAVED_SEARCH_NAME_REGEX = '^[^\p{Cc}\p{Z}]([^\p{Cc}\p{Zl}\p{Zp}]{0,98}[^\p{Cc}\p{Z}])?$';

  exports.EDAM_USER_PASSWORD_LEN_MIN = 6;

  exports.EDAM_USER_PASSWORD_LEN_MAX = 64;

  exports.EDAM_USER_PASSWORD_REGEX = '^[A-Za-z0-9!#$%&\'()*+,./:;<=>?@^_`{|}~\[\]\\-]{6,64}$';

  exports.EDAM_BUSINESS_URI_LEN_MAX = 32;

  exports.EDAM_BUSINESS_MARKETING_CODE_REGEX_PATTERN = '[A-Za-z0-9-]{1,128}';

  exports.EDAM_NOTE_TAGS_MAX = 100;

  exports.EDAM_NOTE_RESOURCES_MAX = 1000;

  exports.EDAM_USER_TAGS_MAX = 100000;

  exports.EDAM_BUSINESS_TAGS_MAX = 100000;

  exports.EDAM_USER_SAVED_SEARCHES_MAX = 100;

  exports.EDAM_USER_NOTES_MAX = 100000;

  exports.EDAM_BUSINESS_NOTES_MAX = 500000;

  exports.EDAM_USER_NOTEBOOKS_MAX = 250;

  exports.EDAM_BUSINESS_NOTEBOOKS_MAX = 10000;

  exports.EDAM_USER_RECENT_MAILED_ADDRESSES_MAX = 10;

  exports.EDAM_USER_MAIL_LIMIT_DAILY_FREE = 50;

  exports.EDAM_USER_MAIL_LIMIT_DAILY_PREMIUM = 200;

  exports.EDAM_USER_UPLOAD_LIMIT_FREE = 62914560;

  exports.EDAM_USER_UPLOAD_LIMIT_PREMIUM = 4294967296;

  exports.EDAM_USER_UPLOAD_LIMIT_PLUS = 1073741824;

  exports.EDAM_USER_UPLOAD_LIMIT_BUSINESS = 4294967296;

  exports.EDAM_USER_UPLOAD_LIMIT_BUSINESS_PER_USER = 2147483647;

  exports.EDAM_NOTE_SIZE_MAX_FREE = 26214400;

  exports.EDAM_NOTE_SIZE_MAX_PREMIUM = 209715200;

  exports.EDAM_RESOURCE_SIZE_MAX_FREE = 26214400;

  exports.EDAM_RESOURCE_SIZE_MAX_PREMIUM = 209715200;

  exports.EDAM_USER_LINKED_NOTEBOOK_MAX = 100;

  exports.EDAM_USER_LINKED_NOTEBOOK_MAX_PREMIUM = 500;

  exports.EDAM_NOTEBOOK_BUSINESS_SHARED_NOTEBOOK_MAX = 5000;

  exports.EDAM_NOTEBOOK_PERSONAL_SHARED_NOTEBOOK_MAX = 500;

  exports.EDAM_NOTE_BUSINESS_SHARED_NOTE_MAX = 1000;

  exports.EDAM_NOTE_PERSONAL_SHARED_NOTE_MAX = 100;

  exports.EDAM_NOTE_CONTENT_CLASS_LEN_MIN = 3;

  exports.EDAM_NOTE_CONTENT_CLASS_LEN_MAX = 32;

  exports.EDAM_NOTE_CONTENT_CLASS_REGEX = '^[A-Za-z0-9_.-]{3,32}$';

  exports.EDAM_HELLO_APP_CONTENT_CLASS_PREFIX = 'evernote.hello.';

  exports.EDAM_FOOD_APP_CONTENT_CLASS_PREFIX = 'evernote.food.';

  exports.EDAM_CONTENT_CLASS_HELLO_ENCOUNTER = 'evernote.hello.encounter';

  exports.EDAM_CONTENT_CLASS_HELLO_PROFILE = 'evernote.hello.profile';

  exports.EDAM_CONTENT_CLASS_FOOD_MEAL = 'evernote.food.meal';

  exports.EDAM_CONTENT_CLASS_SKITCH_PREFIX = 'evernote.skitch';

  exports.EDAM_CONTENT_CLASS_SKITCH = 'evernote.skitch';

  exports.EDAM_CONTENT_CLASS_SKITCH_PDF = 'evernote.skitch.pdf';

  exports.EDAM_CONTENT_CLASS_PENULTIMATE_PREFIX = 'evernote.penultimate.';

  exports.EDAM_CONTENT_CLASS_PENULTIMATE_NOTEBOOK = 'evernote.penultimate.notebook';

  exports.EDAM_SOURCE_APPLICATION_POSTIT = 'postit';

  exports.EDAM_SOURCE_APPLICATION_MOLESKINE = 'moleskine';

  exports.EDAM_SOURCE_APPLICATION_EN_SCANSNAP = 'scanner.scansnap.evernote';

  exports.EDAM_SOURCE_APPLICATION_EWC = 'clipncite.web';

  exports.EDAM_SOURCE_OUTLOOK_CLIPPER = 'app.ms.outlook';

  exports.EDAM_NOTE_TITLE_QUALITY_UNTITLED = 0;

  exports.EDAM_NOTE_TITLE_QUALITY_LOW = 1;

  exports.EDAM_NOTE_TITLE_QUALITY_MEDIUM = 2;

  exports.EDAM_NOTE_TITLE_QUALITY_HIGH = 3;

  exports.EDAM_RELATED_PLAINTEXT_LEN_MIN = 1;

  exports.EDAM_RELATED_PLAINTEXT_LEN_MAX = 131072;

  exports.EDAM_RELATED_MAX_NOTES = 25;

  exports.EDAM_RELATED_MAX_NOTEBOOKS = 1;

  exports.EDAM_RELATED_MAX_TAGS = 25;

  exports.EDAM_RELATED_MAX_EXPERTS = 10;

  exports.EDAM_RELATED_MAX_RELATED_CONTENT = 10;

  exports.EDAM_BUSINESS_NOTEBOOK_DESCRIPTION_LEN_MIN = 1;

  exports.EDAM_BUSINESS_NOTEBOOK_DESCRIPTION_LEN_MAX = 200;

  exports.EDAM_BUSINESS_NOTEBOOK_DESCRIPTION_REGEX = '^[^\p{Cc}\p{Z}]([^\p{Cc}\p{Zl}\p{Zp}]{0,198}[^\p{Cc}\p{Z}])?$';

  exports.EDAM_BUSINESS_PHONE_NUMBER_LEN_MAX = 20;

  exports.EDAM_PREFERENCE_NAME_LEN_MIN = 3;

  exports.EDAM_PREFERENCE_NAME_LEN_MAX = 32;

  exports.EDAM_PREFERENCE_VALUE_LEN_MIN = 1;

  exports.EDAM_PREFERENCE_VALUE_LEN_MAX = 1024;

  exports.EDAM_MAX_PREFERENCES = 100;

  exports.EDAM_MAX_VALUES_PER_PREFERENCE = 256;

  exports.EDAM_PREFERENCE_ONLY_ONE_VALUE_LEN_MAX = 16384;

  exports.EDAM_PREFERENCE_NAME_REGEX = '^[A-Za-z0-9_.-]{3,32}$';

  exports.EDAM_PREFERENCE_VALUE_REGEX = '^[^\p{Cc}]{1,1024}$';

  exports.EDAM_PREFERENCE_ONLY_ONE_VALUE_REGEX = '^[^\p{Cc}]{1,16384}$';

  exports.EDAM_PREFERENCE_SHORTCUTS = 'evernote.shortcuts';

  exports.EDAM_PREFERENCE_BUSINESS_DEFAULT_NOTEBOOK = 'evernote.business.notebook';

  exports.EDAM_PREFERENCE_BUSINESS_QUICKNOTE = 'evernote.business.quicknote';

  exports.EDAM_PREFERENCE_SHORTCUTS_MAX_VALUES = 250;

  exports.EDAM_DEVICE_ID_LEN_MAX = 32;

  exports.EDAM_DEVICE_ID_REGEX = '^[^\p{Cc}]{1,32}$';

  exports.EDAM_DEVICE_DESCRIPTION_LEN_MAX = 64;

  exports.EDAM_DEVICE_DESCRIPTION_REGEX = '^[^\p{Cc}]{1,64}$';

  exports.EDAM_SEARCH_SUGGESTIONS_MAX = 10;

  exports.EDAM_SEARCH_SUGGESTIONS_PREFIX_LEN_MAX = 1024;

  exports.EDAM_SEARCH_SUGGESTIONS_PREFIX_LEN_MIN = 2;

  exports.EDAM_FIND_CONTACT_DEFAULT_MAX_RESULTS = 100;

  exports.EDAM_FIND_CONTACT_MAX_RESULTS = 256;

  exports.EDAM_NOTE_LOCK_VIEWERS_NOTES_MAX = 150;

  exports.EDAM_GET_ORDERS_MAX_RESULTS = 2000;

  exports.EDAM_MESSAGE_BODY_LEN_MAX = 2048;

  exports.EDAM_MESSAGE_BODY_REGEX = '^[^\p{Cc}\p{Z}]([^\p{Cc}\p{Zl}\p{Zp}]{0,2046}[^\p{Cc}\p{Z}])?$';

  exports.EDAM_MESSAGE_RECIPIENTS_MAX = 50;

  exports.EDAM_MESSAGE_ATTACHMENTS_MAX = 100;

  exports.EDAM_MESSAGE_ATTACHMENT_TITLE_LEN_MAX = 255;

  exports.EDAM_MESSAGE_ATTACHMENT_TITLE_REGEX = '^[^\p{Cc}\p{Z}]([^\p{Cc}\p{Zl}\p{Zp}]{0,253}[^\p{Cc}\p{Z}])?$';

  exports.EDAM_MESSAGE_ATTACHMENT_SNIPPET_LEN_MAX = 2048;

  exports.EDAM_MESSAGE_ATTACHMENT_SNIPPET_REGEX = '^[^\p{Cc}\p{Z}]([\n[^\p{Cc}\p{Zl}\p{Zp}]]{0,2046}[^\p{Cc}\p{Z}])?$';

  exports.EDAM_USER_PROFILE_PHOTO_MAX_BYTES = 716800;

  exports.EDAM_PROMOTION_ID_LEN_MAX = 32;

  exports.EDAM_PROMOTION_ID_REGEX = '^[A-Za-z0-9_.-]{1,32}$';

  exports.EDAM_APP_RATING_MIN = 1;

  exports.EDAM_APP_RATING_MAX = 5;

  exports.EDAM_SNIPPETS_NOTES_MAX = 24;

  return exports;

});
//
// Autogenerated by Thrift Compiler (0.5.0-en-exported)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//


define ('Types',['require','thrift','./Limits'],function (require) {

  // Define types and services

  var Thrift = require('thrift');
  var exports = exports || {};

  var Limits = require('./Limits');


  exports.PrivilegeLevel = {
    'NORMAL' : 1,
    'PREMIUM' : 3,
    'VIP' : 5,
    'MANAGER' : 7,
    'SUPPORT' : 8,
    'ADMIN' : 9
  };

  exports.ServiceLevel = {
    'BASIC' : 1,
    'PLUS' : 2,
    'PREMIUM' : 3
  };

  exports.QueryFormat = {
    'USER' : 1,
    'SEXP' : 2
  };

  exports.NoteSortOrder = {
    'CREATED' : 1,
    'UPDATED' : 2,
    'RELEVANCE' : 3,
    'UPDATE_SEQUENCE_NUMBER' : 4,
    'TITLE' : 5
  };

  exports.PremiumOrderStatus = {
    'NONE' : 0,
    'PENDING' : 1,
    'ACTIVE' : 2,
    'FAILED' : 3,
    'CANCELLATION_PENDING' : 4,
    'CANCELED' : 5
  };

  exports.SharedNotebookPrivilegeLevel = {
    'READ_NOTEBOOK' : 0,
    'MODIFY_NOTEBOOK_PLUS_ACTIVITY' : 1,
    'READ_NOTEBOOK_PLUS_ACTIVITY' : 2,
    'GROUP' : 3,
    'FULL_ACCESS' : 4,
    'BUSINESS_FULL_ACCESS' : 5
  };

  exports.SharedNotePrivilegeLevel = {
    'READ_NOTE' : 0,
    'MODIFY_NOTE' : 1,
    'FULL_ACCESS' : 2
  };

  exports.SponsoredGroupRole = {
    'GROUP_MEMBER' : 1,
    'GROUP_ADMIN' : 2,
    'GROUP_OWNER' : 3
  };

  exports.BusinessUserRole = {
    'ADMIN' : 1,
    'NORMAL' : 2
  };

  exports.SharedNotebookInstanceRestrictions = {
    'ONLY_JOINED_OR_PREVIEW' : 1,
    'NO_SHARED_NOTEBOOKS' : 2
  };

  exports.ReminderEmailConfig = {
    'DO_NOT_SEND' : 1,
    'SEND_DAILY_EMAIL' : 2
  };

  exports.BusinessInvitationStatus = {
    'APPROVED' : 0,
    'REQUESTED' : 1,
    'REDEEMED' : 2
  };

  exports.ContactType = {
    'EVERNOTE' : 1,
    'SMS' : 2,
    'FACEBOOK' : 3,
    'EMAIL' : 4,
    'TWITTER' : 5,
    'LINKEDIN' : 6
  };

  exports.RelatedContentType = {
    'NEWS_ARTICLE' : 1,
    'PROFILE_PERSON' : 2,
    'PROFILE_ORGANIZATION' : 3,
    'REFERENCE_MATERIAL' : 4
  };

  exports.RelatedContentAccess = {
    'NOT_ACCESSIBLE' : 0,
    'DIRECT_LINK_ACCESS_OK' : 1,
    'DIRECT_LINK_LOGIN_REQUIRED' : 2,
    'DIRECT_LINK_EMBEDDED_VIEW' : 3
  };

  exports.UserIdentityType = {
    'EVERNOTE_USERID' : 1,
    'EMAIL' : 2,
    'IDENTITYID' : 3
  };

  exports.CLASSIFICATION_RECIPE_USER_NON_RECIPE = '000';

  exports.CLASSIFICATION_RECIPE_USER_RECIPE = '001';

  exports.CLASSIFICATION_RECIPE_SERVICE_RECIPE = '002';

  exports.EDAM_NOTE_SOURCE_WEB_CLIP = 'web.clip';

  exports.EDAM_NOTE_SOURCE_WEB_CLIP_SIMPLIFIED = 'Clearly';

  exports.EDAM_NOTE_SOURCE_MAIL_CLIP = 'mail.clip';

  exports.EDAM_NOTE_SOURCE_MAIL_SMTP_GATEWAY = 'mail.smtp';

  exports.Data = Thrift.Struct.define('Data',  {
    1: { alias: 'bodyHash', type: Thrift.Type.BINARY },
    2: { alias: 'size', type: Thrift.Type.I32 },
    3: { alias: 'body', type: Thrift.Type.BINARY }
  });

  exports.UserAttributes = Thrift.Struct.define('UserAttributes',  {
    1: { alias: 'defaultLocationName', type: Thrift.Type.STRING },
    2: { alias: 'defaultLatitude', type: Thrift.Type.DOUBLE },
    3: { alias: 'defaultLongitude', type: Thrift.Type.DOUBLE },
    4: { alias: 'preactivation', type: Thrift.Type.BOOL },
    5: { alias: 'viewedPromotions', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    6: { alias: 'incomingEmailAddress', type: Thrift.Type.STRING },
    7: { alias: 'recentMailedAddresses', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    9: { alias: 'comments', type: Thrift.Type.STRING },
    11: { alias: 'dateAgreedToTermsOfService', type: Thrift.Type.I64 },
    12: { alias: 'maxReferrals', type: Thrift.Type.I32 },
    13: { alias: 'referralCount', type: Thrift.Type.I32 },
    14: { alias: 'refererCode', type: Thrift.Type.STRING },
    15: { alias: 'sentEmailDate', type: Thrift.Type.I64 },
    16: { alias: 'sentEmailCount', type: Thrift.Type.I32 },
    17: { alias: 'dailyEmailLimit', type: Thrift.Type.I32 },
    18: { alias: 'emailOptOutDate', type: Thrift.Type.I64 },
    19: { alias: 'partnerEmailOptInDate', type: Thrift.Type.I64 },
    20: { alias: 'preferredLanguage', type: Thrift.Type.STRING },
    21: { alias: 'preferredCountry', type: Thrift.Type.STRING },
    22: { alias: 'clipFullPage', type: Thrift.Type.BOOL },
    23: { alias: 'twitterUserName', type: Thrift.Type.STRING },
    24: { alias: 'twitterId', type: Thrift.Type.STRING },
    25: { alias: 'groupName', type: Thrift.Type.STRING },
    26: { alias: 'recognitionLanguage', type: Thrift.Type.STRING },
    28: { alias: 'referralProof', type: Thrift.Type.STRING },
    29: { alias: 'educationalDiscount', type: Thrift.Type.BOOL },
    30: { alias: 'businessAddress', type: Thrift.Type.STRING },
    31: { alias: 'hideSponsorBilling', type: Thrift.Type.BOOL },
    32: { alias: 'taxExempt', type: Thrift.Type.BOOL },
    33: { alias: 'useEmailAutoFiling', type: Thrift.Type.BOOL },
    34: { alias: 'reminderEmailConfig', type: Thrift.Type.I32 },
    35: { alias: 'emailAddressLastConfirmed', type: Thrift.Type.I64 },
    36: { alias: 'passwordUpdated', type: Thrift.Type.I64 }
  });

  exports.BusinessUserAttributes = Thrift.Struct.define('BusinessUserAttributes',  {
    1: { alias: 'title', type: Thrift.Type.STRING },
    2: { alias: 'location', type: Thrift.Type.STRING },
    3: { alias: 'department', type: Thrift.Type.STRING },
    4: { alias: 'mobilePhone', type: Thrift.Type.STRING },
    5: { alias: 'linkedInProfileUrl', type: Thrift.Type.STRING },
    6: { alias: 'workPhone', type: Thrift.Type.STRING },
    7: { alias: 'companyStartDate', type: Thrift.Type.I64 }
  });

  exports.BackupPaymentInfo = Thrift.Struct.define('BackupPaymentInfo',  {
    1: { alias: 'premiumCommerceService', type: Thrift.Type.STRING },
    2: { alias: 'premiumServiceSKU', type: Thrift.Type.STRING },
    3: { alias: 'currency', type: Thrift.Type.STRING },
    4: { alias: 'unitPrice', type: Thrift.Type.I32 },
    5: { alias: 'paymentMethodId', type: Thrift.Type.I32 }
  });

  exports.Accounting = Thrift.Struct.define('Accounting',  {
    1: { alias: 'uploadLimit', type: Thrift.Type.I64 },
    2: { alias: 'uploadLimitEnd', type: Thrift.Type.I64 },
    3: { alias: 'uploadLimitNextMonth', type: Thrift.Type.I64 },
    4: { alias: 'premiumServiceStatus', type: Thrift.Type.I32 },
    5: { alias: 'premiumOrderNumber', type: Thrift.Type.STRING },
    6: { alias: 'premiumCommerceService', type: Thrift.Type.STRING },
    7: { alias: 'premiumServiceStart', type: Thrift.Type.I64 },
    8: { alias: 'premiumServiceSKU', type: Thrift.Type.STRING },
    9: { alias: 'lastSuccessfulCharge', type: Thrift.Type.I64 },
    10: { alias: 'lastFailedCharge', type: Thrift.Type.I64 },
    11: { alias: 'lastFailedChargeReason', type: Thrift.Type.STRING },
    12: { alias: 'nextPaymentDue', type: Thrift.Type.I64 },
    13: { alias: 'premiumLockUntil', type: Thrift.Type.I64 },
    14: { alias: 'updated', type: Thrift.Type.I64 },
    16: { alias: 'premiumSubscriptionNumber', type: Thrift.Type.STRING },
    17: { alias: 'lastRequestedCharge', type: Thrift.Type.I64 },
    18: { alias: 'currency', type: Thrift.Type.STRING },
    19: { alias: 'unitPrice', type: Thrift.Type.I32 },
    20: { alias: 'businessId', type: Thrift.Type.I32 },
    21: { alias: 'businessName', type: Thrift.Type.STRING },
    22: { alias: 'businessRole', type: Thrift.Type.I32 },
    23: { alias: 'unitDiscount', type: Thrift.Type.I32 },
    24: { alias: 'nextChargeDate', type: Thrift.Type.I64 },
    25: { alias: 'availablePoints', type: Thrift.Type.I32 },
    26: { alias: 'backupPaymentInfo', type: Thrift.Type.STRUCT, def: exports.BackupPaymentInfo }
  });

  exports.BusinessUserInfo = Thrift.Struct.define('BusinessUserInfo',  {
    1: { alias: 'businessId', type: Thrift.Type.I32 },
    2: { alias: 'businessName', type: Thrift.Type.STRING },
    3: { alias: 'role', type: Thrift.Type.I32 },
    4: { alias: 'email', type: Thrift.Type.STRING },
    5: { alias: 'updated', type: Thrift.Type.I64 }
  });

  exports.AccountLimits = Thrift.Struct.define('AccountLimits',  {
    1: { alias: 'userMailLimitDaily', type: Thrift.Type.I32 },
    2: { alias: 'noteSizeMax', type: Thrift.Type.I64 },
    3: { alias: 'resourceSizeMax', type: Thrift.Type.I64 },
    4: { alias: 'userLinkedNotebookMax', type: Thrift.Type.I32 },
    5: { alias: 'uploadLimit', type: Thrift.Type.I64 },
    6: { alias: 'userNoteCountMax', type: Thrift.Type.I32 },
    7: { alias: 'userNotebookCountMax', type: Thrift.Type.I32 },
    8: { alias: 'userTagCountMax', type: Thrift.Type.I32 },
    9: { alias: 'noteTagCountMax', type: Thrift.Type.I32 },
    10: { alias: 'userSavedSearchesMax', type: Thrift.Type.I32 },
    11: { alias: 'noteResourceCountMax', type: Thrift.Type.I32 }
  });

  exports.PremiumInfo = Thrift.Struct.define('PremiumInfo',  {
    1: { alias: 'currentTime', type: Thrift.Type.I64 },
    2: { alias: 'premium', type: Thrift.Type.BOOL },
    3: { alias: 'premiumRecurring', type: Thrift.Type.BOOL },
    4: { alias: 'premiumExpirationDate', type: Thrift.Type.I64 },
    5: { alias: 'premiumExtendable', type: Thrift.Type.BOOL },
    6: { alias: 'premiumPending', type: Thrift.Type.BOOL },
    7: { alias: 'premiumCancellationPending', type: Thrift.Type.BOOL },
    8: { alias: 'canPurchaseUploadAllowance', type: Thrift.Type.BOOL },
    9: { alias: 'sponsoredGroupName', type: Thrift.Type.STRING },
    10: { alias: 'sponsoredGroupRole', type: Thrift.Type.I32 },
    11: { alias: 'premiumUpgradable', type: Thrift.Type.BOOL }
  });

  exports.SubscriptionInfo = Thrift.Struct.define('SubscriptionInfo',  {
    1: { alias: 'currentTime', type: Thrift.Type.I64 },
    2: { alias: 'currentlySubscribed', type: Thrift.Type.BOOL },
    3: { alias: 'subscriptionRecurring', type: Thrift.Type.BOOL },
    4: { alias: 'subscriptionExpirationDate', type: Thrift.Type.I64 },
    5: { alias: 'subscriptionPending', type: Thrift.Type.BOOL },
    6: { alias: 'subscriptionCancellationPending', type: Thrift.Type.BOOL },
    7: { alias: 'serviceLevelsEligibleForPurchase', type: Thrift.Type.SET, def: Thrift.Set.define(Thrift.Type.I32) },
    8: { alias: 'currentSku', type: Thrift.Type.STRING },
    9: { alias: 'validUntil', type: Thrift.Type.I64 }
  });

  exports.User = Thrift.Struct.define('User',  {
    1: { alias: 'id', type: Thrift.Type.I32 },
    2: { alias: 'username', type: Thrift.Type.STRING },
    3: { alias: 'email', type: Thrift.Type.STRING },
    4: { alias: 'name', type: Thrift.Type.STRING },
    6: { alias: 'timezone', type: Thrift.Type.STRING },
    7: { alias: 'privilege', type: Thrift.Type.I32 },
    21: { alias: 'serviceLevel', type: Thrift.Type.I32 },
    9: { alias: 'created', type: Thrift.Type.I64 },
    10: { alias: 'updated', type: Thrift.Type.I64 },
    11: { alias: 'deleted', type: Thrift.Type.I64 },
    13: { alias: 'active', type: Thrift.Type.BOOL },
    14: { alias: 'shardId', type: Thrift.Type.STRING },
    15: { alias: 'attributes', type: Thrift.Type.STRUCT, def: exports.UserAttributes },
    16: { alias: 'accounting', type: Thrift.Type.STRUCT, def: exports.Accounting },
    17: { alias: 'premiumInfo', type: Thrift.Type.STRUCT, def: exports.PremiumInfo },
    18: { alias: 'businessUserInfo', type: Thrift.Type.STRUCT, def: exports.BusinessUserInfo },
    19: { alias: 'photoUrl', type: Thrift.Type.STRING },
    20: { alias: 'photoLastUpdated', type: Thrift.Type.I64 },
    22: { alias: 'accountLimits', type: Thrift.Type.STRUCT, def: exports.AccountLimits },
    23: { alias: 'subscriptionInfo', type: Thrift.Type.STRUCT, def: exports.SubscriptionInfo }
  });

  exports.Contact = Thrift.Struct.define('Contact',  {
    1: { alias: 'name', type: Thrift.Type.STRING },
    2: { alias: 'id', type: Thrift.Type.STRING },
    3: { alias: 'type', type: Thrift.Type.I32 },
    4: { alias: 'photoUrl', type: Thrift.Type.STRING },
    5: { alias: 'photoLastUpdated', type: Thrift.Type.I64 },
    6: { alias: 'messagingPermit', type: Thrift.Type.BINARY },
    7: { alias: 'messagingPermitExpires', type: Thrift.Type.I64 }
  });

  exports.Identity = Thrift.Struct.define('Identity',  {
    1: { alias: 'id', type: Thrift.Type.I64 },
    2: { alias: 'contact', type: Thrift.Type.STRUCT, def: exports.Contact },
    3: { alias: 'userId', type: Thrift.Type.I32 },
    4: { alias: 'deactivated', type: Thrift.Type.BOOL },
    5: { alias: 'sameBusiness', type: Thrift.Type.BOOL },
    6: { alias: 'blocked', type: Thrift.Type.BOOL },
    7: { alias: 'userConnected', type: Thrift.Type.BOOL },
    8: { alias: 'eventId', type: Thrift.Type.I64 }
  });

  exports.Tag = Thrift.Struct.define('Tag',  {
    1: { alias: 'guid', type: Thrift.Type.STRING },
    2: { alias: 'name', type: Thrift.Type.STRING },
    3: { alias: 'parentGuid', type: Thrift.Type.STRING },
    4: { alias: 'updateSequenceNum', type: Thrift.Type.I32 }
  });

  exports.LazyMap = Thrift.Struct.define('LazyMap',  {
    1: { alias: 'keysOnly', type: Thrift.Type.SET, def: Thrift.Set.define(Thrift.Type.STRING) },
    2: { alias: 'fullMap', type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.STRING )  }
  });

  exports.ResourceAttributes = Thrift.Struct.define('ResourceAttributes',  {
    1: { alias: 'sourceURL', type: Thrift.Type.STRING },
    2: { alias: 'timestamp', type: Thrift.Type.I64 },
    3: { alias: 'latitude', type: Thrift.Type.DOUBLE },
    4: { alias: 'longitude', type: Thrift.Type.DOUBLE },
    5: { alias: 'altitude', type: Thrift.Type.DOUBLE },
    6: { alias: 'cameraMake', type: Thrift.Type.STRING },
    7: { alias: 'cameraModel', type: Thrift.Type.STRING },
    8: { alias: 'clientWillIndex', type: Thrift.Type.BOOL },
    9: { alias: 'recoType', type: Thrift.Type.STRING },
    10: { alias: 'fileName', type: Thrift.Type.STRING },
    11: { alias: 'attachment', type: Thrift.Type.BOOL },
    12: { alias: 'applicationData', type: Thrift.Type.STRUCT, def: exports.LazyMap }
  });

  exports.Resource = Thrift.Struct.define('Resource',  {
    1: { alias: 'guid', type: Thrift.Type.STRING },
    2: { alias: 'noteGuid', type: Thrift.Type.STRING },
    3: { alias: 'data', type: Thrift.Type.STRUCT, def: exports.Data },
    4: { alias: 'mime', type: Thrift.Type.STRING },
    5: { alias: 'width', type: Thrift.Type.I16 },
    6: { alias: 'height', type: Thrift.Type.I16 },
    7: { alias: 'duration', type: Thrift.Type.I16 },
    8: { alias: 'active', type: Thrift.Type.BOOL },
    9: { alias: 'recognition', type: Thrift.Type.STRUCT, def: exports.Data },
    11: { alias: 'attributes', type: Thrift.Type.STRUCT, def: exports.ResourceAttributes },
    12: { alias: 'updateSequenceNum', type: Thrift.Type.I32 },
    13: { alias: 'alternateData', type: Thrift.Type.STRUCT, def: exports.Data }
  });

  exports.NoteAttributes = Thrift.Struct.define('NoteAttributes',  {
    1: { alias: 'subjectDate', type: Thrift.Type.I64 },
    10: { alias: 'latitude', type: Thrift.Type.DOUBLE },
    11: { alias: 'longitude', type: Thrift.Type.DOUBLE },
    12: { alias: 'altitude', type: Thrift.Type.DOUBLE },
    13: { alias: 'author', type: Thrift.Type.STRING },
    14: { alias: 'source', type: Thrift.Type.STRING },
    15: { alias: 'sourceURL', type: Thrift.Type.STRING },
    16: { alias: 'sourceApplication', type: Thrift.Type.STRING },
    17: { alias: 'shareDate', type: Thrift.Type.I64 },
    18: { alias: 'reminderOrder', type: Thrift.Type.I64 },
    19: { alias: 'reminderDoneTime', type: Thrift.Type.I64 },
    20: { alias: 'reminderTime', type: Thrift.Type.I64 },
    21: { alias: 'placeName', type: Thrift.Type.STRING },
    22: { alias: 'contentClass', type: Thrift.Type.STRING },
    23: { alias: 'applicationData', type: Thrift.Type.STRUCT, def: exports.LazyMap },
    24: { alias: 'lastEditedBy', type: Thrift.Type.STRING },
    26: { alias: 'classifications', type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.STRING )  },
    27: { alias: 'creatorId', type: Thrift.Type.I32 },
    28: { alias: 'lastEditorId', type: Thrift.Type.I32 },
    29: { alias: 'sharedWithBusiness', type: Thrift.Type.BOOL },
    30: { alias: 'conflictSourceNoteGuid', type: Thrift.Type.STRING },
    31: { alias: 'noteTitleQuality', type: Thrift.Type.I32 }
  });

  exports.SharedNote = Thrift.Struct.define('SharedNote',  {
    1: { alias: 'sharerUserID', type: Thrift.Type.I32 },
    2: { alias: 'recipientIdentity', type: Thrift.Type.STRUCT, def: exports.Identity },
    3: { alias: 'privilege', type: Thrift.Type.I32 },
    4: { alias: 'serviceCreated', type: Thrift.Type.I64 },
    5: { alias: 'serviceUpdated', type: Thrift.Type.I64 },
    6: { alias: 'serviceAssigned', type: Thrift.Type.I64 }
  });

  exports.NoteRestrictions = Thrift.Struct.define('NoteRestrictions',  {
    1: { alias: 'noUpdateTitle', type: Thrift.Type.BOOL },
    2: { alias: 'noUpdateContent', type: Thrift.Type.BOOL },
    3: { alias: 'noEmail', type: Thrift.Type.BOOL },
    4: { alias: 'noShare', type: Thrift.Type.BOOL },
    5: { alias: 'noSharePublicly', type: Thrift.Type.BOOL }
  });

  exports.Note = Thrift.Struct.define('Note',  {
    1: { alias: 'guid', type: Thrift.Type.STRING },
    2: { alias: 'title', type: Thrift.Type.STRING },
    3: { alias: 'content', type: Thrift.Type.STRING },
    4: { alias: 'contentHash', type: Thrift.Type.BINARY },
    5: { alias: 'contentLength', type: Thrift.Type.I32 },
    6: { alias: 'created', type: Thrift.Type.I64 },
    7: { alias: 'updated', type: Thrift.Type.I64 },
    8: { alias: 'deleted', type: Thrift.Type.I64 },
    9: { alias: 'active', type: Thrift.Type.BOOL },
    10: { alias: 'updateSequenceNum', type: Thrift.Type.I32 },
    11: { alias: 'notebookGuid', type: Thrift.Type.STRING },
    12: { alias: 'tagGuids', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    13: { alias: 'resources', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.Resource)  },
    14: { alias: 'attributes', type: Thrift.Type.STRUCT, def: exports.NoteAttributes },
    15: { alias: 'tagNames', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    16: { alias: 'sharedNotes', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.SharedNote)  },
    17: { alias: 'restrictions', type: Thrift.Type.STRUCT, def: exports.NoteRestrictions }
  });

  exports.Publishing = Thrift.Struct.define('Publishing',  {
    1: { alias: 'uri', type: Thrift.Type.STRING },
    2: { alias: 'order', type: Thrift.Type.I32 },
    3: { alias: 'ascending', type: Thrift.Type.BOOL },
    4: { alias: 'publicDescription', type: Thrift.Type.STRING }
  });

  exports.BusinessNotebook = Thrift.Struct.define('BusinessNotebook',  {
    1: { alias: 'notebookDescription', type: Thrift.Type.STRING },
    2: { alias: 'privilege', type: Thrift.Type.I32 },
    3: { alias: 'recommended', type: Thrift.Type.BOOL }
  });

  exports.SavedSearchScope = Thrift.Struct.define('SavedSearchScope',  {
    1: { alias: 'includeAccount', type: Thrift.Type.BOOL },
    2: { alias: 'includePersonalLinkedNotebooks', type: Thrift.Type.BOOL },
    3: { alias: 'includeBusinessLinkedNotebooks', type: Thrift.Type.BOOL }
  });

  exports.SavedSearch = Thrift.Struct.define('SavedSearch',  {
    1: { alias: 'guid', type: Thrift.Type.STRING },
    2: { alias: 'name', type: Thrift.Type.STRING },
    3: { alias: 'query', type: Thrift.Type.STRING },
    4: { alias: 'format', type: Thrift.Type.I32 },
    5: { alias: 'updateSequenceNum', type: Thrift.Type.I32 },
    6: { alias: 'scope', type: Thrift.Type.STRUCT, def: exports.SavedSearchScope }
  });

  exports.Ad = Thrift.Struct.define('Ad',  {
    1: { alias: 'id', type: Thrift.Type.I32 },
    2: { alias: 'width', type: Thrift.Type.I16 },
    3: { alias: 'height', type: Thrift.Type.I16 },
    4: { alias: 'advertiserName', type: Thrift.Type.STRING },
    5: { alias: 'imageUrl', type: Thrift.Type.STRING },
    6: { alias: 'destinationUrl', type: Thrift.Type.STRING },
    7: { alias: 'displaySeconds', type: Thrift.Type.I16 },
    8: { alias: 'score', type: Thrift.Type.DOUBLE },
    9: { alias: 'image', type: Thrift.Type.BINARY },
    10: { alias: 'imageMime', type: Thrift.Type.STRING },
    11: { alias: 'html', type: Thrift.Type.STRING },
    12: { alias: 'displayFrequency', type: Thrift.Type.DOUBLE },
    13: { alias: 'openInTrunk', type: Thrift.Type.BOOL }
  });

  exports.SharedNotebookRecipientSettings = Thrift.Struct.define('SharedNotebookRecipientSettings',  {
    1: { alias: 'reminderNotifyEmail', type: Thrift.Type.BOOL },
    2: { alias: 'reminderNotifyInApp', type: Thrift.Type.BOOL }
  });

  exports.NotebookRecipientSettings = Thrift.Struct.define('NotebookRecipientSettings',  {
    1: { alias: 'reminderNotifyEmail', type: Thrift.Type.BOOL },
    2: { alias: 'reminderNotifyInApp', type: Thrift.Type.BOOL },
    3: { alias: 'inMyList', type: Thrift.Type.BOOL },
    4: { alias: 'stack', type: Thrift.Type.STRING }
  });

  exports.SharedNotebook = Thrift.Struct.define('SharedNotebook',  {
    1: { alias: 'id', type: Thrift.Type.I64 },
    2: { alias: 'userId', type: Thrift.Type.I32 },
    3: { alias: 'notebookGuid', type: Thrift.Type.STRING },
    4: { alias: 'email', type: Thrift.Type.STRING },
    18: { alias: 'recipientIdentityId', type: Thrift.Type.I64 },
    5: { alias: 'notebookModifiable', type: Thrift.Type.BOOL },
    6: { alias: 'requireLogin', type: Thrift.Type.BOOL },
    7: { alias: 'serviceCreated', type: Thrift.Type.I64 },
    10: { alias: 'serviceUpdated', type: Thrift.Type.I64 },
    8: { alias: 'globalId', type: Thrift.Type.STRING },
    9: { alias: 'username', type: Thrift.Type.STRING },
    11: { alias: 'privilege', type: Thrift.Type.I32 },
    12: { alias: 'allowPreview', type: Thrift.Type.BOOL },
    13: { alias: 'recipientSettings', type: Thrift.Type.STRUCT, def: exports.SharedNotebookRecipientSettings },
    14: { alias: 'sharerUserId', type: Thrift.Type.I32 },
    15: { alias: 'recipientUsername', type: Thrift.Type.STRING },
    17: { alias: 'recipientUserId', type: Thrift.Type.I32 },
    16: { alias: 'serviceAssigned', type: Thrift.Type.I64 }
  });

  exports.NotebookRestrictions = Thrift.Struct.define('NotebookRestrictions',  {
    1: { alias: 'noReadNotes', type: Thrift.Type.BOOL },
    2: { alias: 'noCreateNotes', type: Thrift.Type.BOOL },
    3: { alias: 'noUpdateNotes', type: Thrift.Type.BOOL },
    4: { alias: 'noExpungeNotes', type: Thrift.Type.BOOL },
    5: { alias: 'noShareNotes', type: Thrift.Type.BOOL },
    6: { alias: 'noEmailNotes', type: Thrift.Type.BOOL },
    7: { alias: 'noSendMessageToRecipients', type: Thrift.Type.BOOL },
    8: { alias: 'noUpdateNotebook', type: Thrift.Type.BOOL },
    9: { alias: 'noExpungeNotebook', type: Thrift.Type.BOOL },
    10: { alias: 'noSetDefaultNotebook', type: Thrift.Type.BOOL },
    11: { alias: 'noSetNotebookStack', type: Thrift.Type.BOOL },
    12: { alias: 'noPublishToPublic', type: Thrift.Type.BOOL },
    13: { alias: 'noPublishToBusinessLibrary', type: Thrift.Type.BOOL },
    14: { alias: 'noCreateTags', type: Thrift.Type.BOOL },
    15: { alias: 'noUpdateTags', type: Thrift.Type.BOOL },
    16: { alias: 'noExpungeTags', type: Thrift.Type.BOOL },
    17: { alias: 'noSetParentTag', type: Thrift.Type.BOOL },
    18: { alias: 'noCreateSharedNotebooks', type: Thrift.Type.BOOL },
    19: { alias: 'updateWhichSharedNotebookRestrictions', type: Thrift.Type.I32 },
    20: { alias: 'expungeWhichSharedNotebookRestrictions', type: Thrift.Type.I32 },
    21: { alias: 'noShareNotesWithBusiness', type: Thrift.Type.BOOL }
  });

  exports.Notebook = Thrift.Struct.define('Notebook',  {
    1: { alias: 'guid', type: Thrift.Type.STRING },
    2: { alias: 'name', type: Thrift.Type.STRING },
    5: { alias: 'updateSequenceNum', type: Thrift.Type.I32 },
    6: { alias: 'defaultNotebook', type: Thrift.Type.BOOL },
    7: { alias: 'serviceCreated', type: Thrift.Type.I64 },
    8: { alias: 'serviceUpdated', type: Thrift.Type.I64 },
    10: { alias: 'publishing', type: Thrift.Type.STRUCT, def: exports.Publishing },
    11: { alias: 'published', type: Thrift.Type.BOOL },
    12: { alias: 'stack', type: Thrift.Type.STRING },
    13: { alias: 'sharedNotebookIds', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I64)  },
    14: { alias: 'sharedNotebooks', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.SharedNotebook)  },
    15: { alias: 'businessNotebook', type: Thrift.Type.STRUCT, def: exports.BusinessNotebook },
    16: { alias: 'contact', type: Thrift.Type.STRUCT, def: exports.User },
    17: { alias: 'restrictions', type: Thrift.Type.STRUCT, def: exports.NotebookRestrictions },
    18: { alias: 'recipientSettings', type: Thrift.Type.STRUCT, def: exports.NotebookRecipientSettings }
  });

  exports.LinkedNotebook = Thrift.Struct.define('LinkedNotebook',  {
    2: { alias: 'shareName', type: Thrift.Type.STRING },
    3: { alias: 'username', type: Thrift.Type.STRING },
    4: { alias: 'shardId', type: Thrift.Type.STRING },
    5: { alias: 'sharedNotebookGlobalId', type: Thrift.Type.STRING },
    6: { alias: 'uri', type: Thrift.Type.STRING },
    7: { alias: 'guid', type: Thrift.Type.STRING },
    8: { alias: 'updateSequenceNum', type: Thrift.Type.I32 },
    9: { alias: 'noteStoreUrl', type: Thrift.Type.STRING },
    10: { alias: 'webApiUrlPrefix', type: Thrift.Type.STRING },
    11: { alias: 'stack', type: Thrift.Type.STRING },
    12: { alias: 'businessId', type: Thrift.Type.I32 }
  });

  exports.NotebookDescriptor = Thrift.Struct.define('NotebookDescriptor',  {
    1: { alias: 'guid', type: Thrift.Type.STRING },
    2: { alias: 'notebookDisplayName', type: Thrift.Type.STRING },
    3: { alias: 'contactName', type: Thrift.Type.STRING },
    4: { alias: 'hasSharedNotebook', type: Thrift.Type.BOOL },
    5: { alias: 'joinedUserCount', type: Thrift.Type.I32 }
  });

  exports.UserProfile = Thrift.Struct.define('UserProfile',  {
    1: { alias: 'id', type: Thrift.Type.I32 },
    2: { alias: 'name', type: Thrift.Type.STRING },
    3: { alias: 'email', type: Thrift.Type.STRING },
    4: { alias: 'username', type: Thrift.Type.STRING },
    5: { alias: 'attributes', type: Thrift.Type.STRUCT, def: exports.BusinessUserAttributes },
    6: { alias: 'joined', type: Thrift.Type.I64 },
    7: { alias: 'photoLastUpdated', type: Thrift.Type.I64 },
    8: { alias: 'photoUrl', type: Thrift.Type.STRING }
  });

  exports.RelatedContentImage = Thrift.Struct.define('RelatedContentImage',  {
    1: { alias: 'url', type: Thrift.Type.STRING },
    2: { alias: 'width', type: Thrift.Type.I32 },
    3: { alias: 'height', type: Thrift.Type.I32 },
    4: { alias: 'pixelRatio', type: Thrift.Type.DOUBLE },
    5: { alias: 'fileSize', type: Thrift.Type.I32 }
  });

  exports.RelatedContent = Thrift.Struct.define('RelatedContent',  {
    1: { alias: 'contentId', type: Thrift.Type.STRING },
    2: { alias: 'title', type: Thrift.Type.STRING },
    3: { alias: 'url', type: Thrift.Type.STRING },
    4: { alias: 'sourceId', type: Thrift.Type.STRING },
    5: { alias: 'sourceUrl', type: Thrift.Type.STRING },
    6: { alias: 'sourceFaviconUrl', type: Thrift.Type.STRING },
    7: { alias: 'sourceName', type: Thrift.Type.STRING },
    8: { alias: 'date', type: Thrift.Type.I64 },
    9: { alias: 'teaser', type: Thrift.Type.STRING },
    10: { alias: 'thumbnails', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.RelatedContentImage)  },
    11: { alias: 'contentType', type: Thrift.Type.I32 },
    12: { alias: 'accessType', type: Thrift.Type.I32 },
    13: { alias: 'visibleUrl', type: Thrift.Type.STRING },
    14: { alias: 'clipUrl', type: Thrift.Type.STRING },
    15: { alias: 'contact', type: Thrift.Type.STRUCT, def: exports.Contact },
    16: { alias: 'authors', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  }
  });

  exports.BusinessInvitation = Thrift.Struct.define('BusinessInvitation',  {
    1: { alias: 'businessId', type: Thrift.Type.I32 },
    2: { alias: 'email', type: Thrift.Type.STRING },
    3: { alias: 'role', type: Thrift.Type.I32 },
    4: { alias: 'status', type: Thrift.Type.I32 },
    5: { alias: 'requesterId', type: Thrift.Type.I32 },
    6: { alias: 'fromWorkChat', type: Thrift.Type.BOOL }
  });

  exports.UserIdentity = Thrift.Struct.define('UserIdentity',  {
    1: { alias: 'type', type: Thrift.Type.I32 },
    2: { alias: 'stringIdentifier', type: Thrift.Type.STRING },
    3: { alias: 'longIdentifier', type: Thrift.Type.I64 }
  });

  return exports;

});
//
// Autogenerated by Thrift Compiler (0.5.0-en-exported)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//


define ('Errors',['require','thrift','./Types'],function (require) {

  // Define types and services

  var Thrift = require('thrift');
  var exports = exports || {};

  var Types = require('./Types');


  exports.EDAMErrorCode = {
    'UNKNOWN' : 1,
    'BAD_DATA_FORMAT' : 2,
    'PERMISSION_DENIED' : 3,
    'INTERNAL_ERROR' : 4,
    'DATA_REQUIRED' : 5,
    'LIMIT_REACHED' : 6,
    'QUOTA_REACHED' : 7,
    'INVALID_AUTH' : 8,
    'AUTH_EXPIRED' : 9,
    'DATA_CONFLICT' : 10,
    'ENML_VALIDATION' : 11,
    'SHARD_UNAVAILABLE' : 12,
    'LEN_TOO_SHORT' : 13,
    'LEN_TOO_LONG' : 14,
    'TOO_FEW' : 15,
    'TOO_MANY' : 16,
    'UNSUPPORTED_OPERATION' : 17,
    'TAKEN_DOWN' : 18,
    'RATE_LIMIT_REACHED' : 19,
    'BUSINESS_SECURITY_LOGIN_REQUIRED' : 20
  };

  exports.EDAMInvalidContactReason = {
    'BAD_ADDRESS' : 0,
    'DUPLICATE_CONTACT' : 1,
    'NO_CONNECTION' : 2
  };

  exports.EDAMUserException = Thrift.Exception.define('EDAMUserException',  {
    1: { alias: 'errorCode', type: Thrift.Type.I32 },
    2: { alias: 'parameter', type: Thrift.Type.STRING }
  });

  exports.EDAMSystemException = Thrift.Exception.define('EDAMSystemException',  {
    1: { alias: 'errorCode', type: Thrift.Type.I32 },
    2: { alias: 'message', type: Thrift.Type.STRING },
    3: { alias: 'rateLimitDuration', type: Thrift.Type.I32 }
  });

  exports.EDAMNotFoundException = Thrift.Exception.define('EDAMNotFoundException',  {
    1: { alias: 'identifier', type: Thrift.Type.STRING },
    2: { alias: 'key', type: Thrift.Type.STRING }
  });

  exports.EDAMInvalidContactsException = Thrift.Exception.define('EDAMInvalidContactsException',  {
    1: { alias: 'contacts', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Contact)  },
    2: { alias: 'parameter', type: Thrift.Type.STRING },
    3: { alias: 'reasons', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I32)  }
  });

  return exports;

});
//
// Autogenerated by Thrift Compiler (0.5.0-en-exported)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//


define ('MessageStore',['require','thrift','./Errors','./Types'],function (require) {

  // Define types and services

  var Thrift = require('thrift');
  var exports = exports || {};

  var Errors = require('./Errors');
  var Types = require('./Types');


  exports.MessageAttachmentType = {
    'NOTE' : 1,
    'NOTEBOOK' : 2
  };

  exports.PaginationDirection = {
    'OLDER' : 1,
    'NEWER' : 2
  };

  exports.MessageThreadChangeType = {
    'PARTICIPANT_ADDED' : 1,
    'PARTICIPANT_REMOVED' : 2,
    'MESSAGE_THREAD_RENAMED' : 3
  };

  exports.EDAM_MESSAGE_NEWEST_MESSAGE_ID = -1;

  exports.FIND_MESSAGE_FIELD_ID = 'id';

  exports.FIND_MESSAGE_FIELD_SENDER_ID = 'senderId';

  exports.FIND_MESSAGE_FIELD_THREAD_ID = 'threadId';

  exports.FIND_MESSAGE_FIELD_SENT_AT = 'sentAt';

  exports.FIND_MESSAGE_FIELD_BODY = 'body';

  exports.FIND_MESSAGE_FIELD_ATTACHMENT_GUID = 'attachmentGuid';

  exports.FIND_MESSAGE_FIELD_ATTACHMENT_SHARD = 'attachmentShardId';

  exports.FIND_MESSAGE_FIELD_ATTACHMENT_TYPE = 'attachmentType';

  exports.FIND_MESSAGE_FIELD_ATTACHMENT_TITLE = 'attachmentTitle';

  exports.FIND_MESSAGE_FIELD_ATTACHMENT_SNIPPET = 'attachmentSnippet';

  exports.EDAM_MESSAGE_THREAD_NAME_LEN_MIN = 1;

  exports.EDAM_MESSAGE_THREAD_NAME_LEN_MAX = 64;

  exports.EDAM_MESSAGE_THREAD_NAME_REGEX = '^[^\p{Cc}\p{Z}]([^\p{Cc}\p{Zl}\p{Zp}]{0,62}[^\p{Cc}\p{Z}])?$';

  exports.FIND_MESSAGE_FIELDS = ['id','senderId','threadId','sentAt','body','attachmentGuid','attachmentShardId','attachmentType','attachmentTitle','attachmentSnippet'];

  exports.MessageAttachment = Thrift.Struct.define('MessageAttachment',  {
    1: { alias: 'guid', type: Thrift.Type.STRING },
    2: { alias: 'shardId', type: Thrift.Type.STRING },
    3: { alias: 'type', type: Thrift.Type.I32 },
    4: { alias: 'title', type: Thrift.Type.STRING },
    5: { alias: 'snippet', type: Thrift.Type.STRING },
    6: { alias: 'noteStoreUrl', type: Thrift.Type.STRING },
    7: { alias: 'userId', type: Thrift.Type.I32 },
    8: { alias: 'webApiUrlPrefix', type: Thrift.Type.STRING }
  });

  exports.MessageThreadChange = Thrift.Struct.define('MessageThreadChange',  {
    1: { alias: 'id', type: Thrift.Type.I64 },
    2: { alias: 'changeType', type: Thrift.Type.I32 },
    3: { alias: 'messageThreadId', type: Thrift.Type.I64 },
    4: { alias: 'changedByUserId', type: Thrift.Type.I32 },
    5: { alias: 'changedAt', type: Thrift.Type.I64 },
    6: { alias: 'eventId', type: Thrift.Type.I64 },
    7: { alias: 'stringValue', type: Thrift.Type.STRING },
    8: { alias: 'identityValue', type: Thrift.Type.STRUCT, def: Types.Identity }
  });

  exports.Message = Thrift.Struct.define('Message',  {
    1: { alias: 'id', type: Thrift.Type.I64 },
    2: { alias: 'senderId', type: Thrift.Type.I32 },
    3: { alias: 'messageThreadId', type: Thrift.Type.I64 },
    4: { alias: 'sentAt', type: Thrift.Type.I64 },
    5: { alias: 'body', type: Thrift.Type.STRING },
    6: { alias: 'attachments', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.MessageAttachment)  },
    7: { alias: 'eventId', type: Thrift.Type.I64 },
    8: { alias: 'reshareMessage', type: Thrift.Type.BOOL }
  });

  exports.MessageThread = Thrift.Struct.define('MessageThread',  {
    1: { alias: 'id', type: Thrift.Type.I64 },
    2: { alias: 'participantIds', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I64)  },
    3: { alias: 'snippet', type: Thrift.Type.STRING },
    4: { alias: 'threadMaxMessageId', type: Thrift.Type.I64 },
    5: { alias: 'lastMessageSentAt', type: Thrift.Type.I64 },
    6: { alias: 'name', type: Thrift.Type.STRING },
    8: { alias: 'groupThread', type: Thrift.Type.BOOL }
  });

  exports.UserThread = Thrift.Struct.define('UserThread',  {
    1: { alias: 'messageThread', type: Thrift.Type.STRUCT, def: exports.MessageThread },
    2: { alias: 'lastReadMessageId', type: Thrift.Type.I64 },
    3: { alias: 'maxDeletedMessageId', type: Thrift.Type.I64 },
    4: { alias: 'eventId', type: Thrift.Type.I64 }
  });

  exports.Destination = Thrift.Struct.define('Destination',  {
    1: { alias: 'messageThreadId', type: Thrift.Type.I64 },
    2: { alias: 'recipients', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Contact)  }
  });

  exports.UserMessagingInfo = Thrift.Struct.define('UserMessagingInfo',  {
    1: { alias: 'threads', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.UserThread)  },
    2: { alias: 'identities', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Identity)  }
  });

  exports.UserThreadInfo = Thrift.Struct.define('UserThreadInfo',  {
    1: { alias: 'messages', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.Message)  },
    2: { alias: 'hasMore', type: Thrift.Type.BOOL },
    3: { alias: 'threadChanges', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.MessageThreadChange)  }
  });

  exports.MessageFilter = Thrift.Struct.define('MessageFilter',  {
    1: { alias: 'startMessageId', type: Thrift.Type.I64 },
    2: { alias: 'direction', type: Thrift.Type.I32 }
  });

  exports.MessageSyncFilter = Thrift.Struct.define('MessageSyncFilter',  {
    1: { alias: 'afterEventId', type: Thrift.Type.I64 }
  });

  exports.MessageSyncChunk = Thrift.Struct.define('MessageSyncChunk',  {
    1: { alias: 'chunkMaxEventId', type: Thrift.Type.I64 },
    2: { alias: 'userMaxEventId', type: Thrift.Type.I64 },
    3: { alias: 'threads', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.UserThread)  },
    4: { alias: 'messages', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.Message)  },
    5: { alias: 'identities', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Identity)  },
    6: { alias: 'threadChanges', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.MessageThreadChange)  }
  });

  exports.FindMessagesFilter = Thrift.Struct.define('FindMessagesFilter',  {
    1: { alias: 'query', type: Thrift.Type.STRING },
    2: { alias: 'sortField', type: Thrift.Type.STRING },
    3: { alias: 'reverse', type: Thrift.Type.BOOL },
    4: { alias: 'includeBlocked', type: Thrift.Type.BOOL }
  });

  exports.FindMessagesResultSpec = Thrift.Struct.define('FindMessagesResultSpec',  {
    1: { alias: 'includeBody', type: Thrift.Type.BOOL },
    2: { alias: 'includeAttachments', type: Thrift.Type.BOOL }
  });

  exports.FindMessagesPagination = Thrift.Struct.define('FindMessagesPagination',  {
    1: { alias: 'afterMessageId', type: Thrift.Type.I64 },
    2: { alias: 'afterOffset', type: Thrift.Type.I32 }
  });

  exports.FindMessagesResult = Thrift.Struct.define('FindMessagesResult',  {
    1: { alias: 'messages', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.Message)  },
    2: { alias: 'totalMatched', type: Thrift.Type.I32 },
    3: { alias: 'nextPagination', type: Thrift.Type.STRUCT, def: exports.FindMessagesPagination }
  });

  exports.CreateMessageThreadSpec = Thrift.Struct.define('CreateMessageThreadSpec',  {
    1: { alias: 'message', type: Thrift.Type.STRUCT, def: exports.Message },
    2: { alias: 'participants', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Contact)  },
    3: { alias: 'messageThreadName', type: Thrift.Type.STRING },
    4: { alias: 'groupThread', type: Thrift.Type.BOOL }
  });

  exports.CreateMessageThreadResult = Thrift.Struct.define('CreateMessageThreadResult',  {
    1: { alias: 'messageId', type: Thrift.Type.I64 },
    2: { alias: 'messageThreadId', type: Thrift.Type.I64 },
    3: { alias: 'participantIds', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I64)  }
  });

  exports.UpdateParticipantsSpec = Thrift.Struct.define('UpdateParticipantsSpec',  {
    1: { alias: 'threadId', type: Thrift.Type.I64 },
    2: { alias: 'participantsToAdd', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Contact)  },
    3: { alias: 'participantsToRemove', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I64)  }
  });

  exports.UpdateParticipantsResult = Thrift.Struct.define('UpdateParticipantsResult',  {
    1: { alias: 'participantIds', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I64)  }
  });

  exports.ReinviteContactResult = Thrift.Struct.define('ReinviteContactResult',  {
    1: { alias: 'participantIds', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I64)  }
  });

  var MessageStore = exports.MessageStore = {};

  MessageStore.sendMessage = Thrift.Method.define({
    alias: 'sendMessage',
    args: Thrift.Struct.define('sendMessageArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'message', type: Thrift.Type.STRUCT, def: exports.Message, index: 1 },
      3: { alias: 'destination', type: Thrift.Type.STRUCT, def: exports.Destination, index: 2 }
    }),
    result: Thrift.Struct.define('sendMessageResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.Message },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'invalidContactsException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMInvalidContactsException }
    })
  });

  MessageStore.sendMessageToThread = Thrift.Method.define({
    alias: 'sendMessageToThread',
    args: Thrift.Struct.define('sendMessageToThreadArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'threadId', type: Thrift.Type.I64, index: 1 },
      3: { alias: 'message', type: Thrift.Type.STRUCT, def: exports.Message, index: 2 }
    }),
    result: Thrift.Struct.define('sendMessageToThreadResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.Message },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  MessageStore.createMessageThread = Thrift.Method.define({
    alias: 'createMessageThread',
    args: Thrift.Struct.define('createMessageThreadArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'spec', type: Thrift.Type.STRUCT, def: exports.CreateMessageThreadSpec, index: 1 }
    }),
    result: Thrift.Struct.define('createMessageThreadResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.CreateMessageThreadResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'invalidContactsException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMInvalidContactsException }
    })
  });

  MessageStore.updateParticipants = Thrift.Method.define({
    alias: 'updateParticipants',
    args: Thrift.Struct.define('updateParticipantsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'spec', type: Thrift.Type.STRUCT, def: exports.UpdateParticipantsSpec, index: 1 }
    }),
    result: Thrift.Struct.define('updateParticipantsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.UpdateParticipantsResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'invalidContactsException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMInvalidContactsException }
    })
  });

  MessageStore.reinviteContact = Thrift.Method.define({
    alias: 'reinviteContact',
    args: Thrift.Struct.define('reinviteContactArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'threadId', type: Thrift.Type.I64, index: 1 },
      3: { alias: 'contact', type: Thrift.Type.STRUCT, def: Types.Contact, index: 2 }
    }),
    result: Thrift.Struct.define('reinviteContactResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.ReinviteContactResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'invalidContactsException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMInvalidContactsException }
    })
  });

  MessageStore.renameMessageThread = Thrift.Method.define({
    alias: 'renameMessageThread',
    args: Thrift.Struct.define('renameMessageThreadArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'threadId', type: Thrift.Type.I64, index: 1 },
      3: { alias: 'threadName', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('renameMessageThreadResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  MessageStore.updateReadStatus = Thrift.Method.define({
    alias: 'updateReadStatus',
    args: Thrift.Struct.define('updateReadStatusArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'threadId', type: Thrift.Type.I64, index: 1 },
      3: { alias: 'messageId', type: Thrift.Type.I64, index: 2 }
    }),
    result: Thrift.Struct.define('updateReadStatusResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I64 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  MessageStore.updateDeleteStatus = Thrift.Method.define({
    alias: 'updateDeleteStatus',
    args: Thrift.Struct.define('updateDeleteStatusArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'threadId', type: Thrift.Type.I64, index: 1 },
      3: { alias: 'messageId', type: Thrift.Type.I64, index: 2 }
    }),
    result: Thrift.Struct.define('updateDeleteStatusResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I64 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  MessageStore.getMessages = Thrift.Method.define({
    alias: 'getMessages',
    args: Thrift.Struct.define('getMessagesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'threadId', type: Thrift.Type.I64, index: 1 },
      3: { alias: 'filter', type: Thrift.Type.STRUCT, def: exports.MessageFilter, index: 2 }
    }),
    result: Thrift.Struct.define('getMessagesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.UserThreadInfo },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  MessageStore.getThreads = Thrift.Method.define({
    alias: 'getThreads',
    args: Thrift.Struct.define('getThreadsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getThreadsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.UserMessagingInfo },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  MessageStore.getMessageSyncChunk = Thrift.Method.define({
    alias: 'getMessageSyncChunk',
    args: Thrift.Struct.define('getMessageSyncChunkArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'filter', type: Thrift.Type.STRUCT, def: exports.MessageSyncFilter, index: 1 }
    }),
    result: Thrift.Struct.define('getMessageSyncChunkResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.MessageSyncChunk },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  MessageStore.updateBlockStatus = Thrift.Method.define({
    alias: 'updateBlockStatus',
    args: Thrift.Struct.define('updateBlockStatusArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'userId', type: Thrift.Type.I32, index: 1 },
      3: { alias: 'blockStatus', type: Thrift.Type.BOOL, index: 2 }
    }),
    result: Thrift.Struct.define('updateBlockStatusResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  MessageStore.findMessages = Thrift.Method.define({
    alias: 'findMessages',
    args: Thrift.Struct.define('findMessagesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'filter', type: Thrift.Type.STRUCT, def: exports.FindMessagesFilter, index: 1 },
      3: { alias: 'resultSpec', type: Thrift.Type.STRUCT, def: exports.FindMessagesResultSpec, index: 2 },
      4: { alias: 'maxMessages', type: Thrift.Type.I32, index: 3 },
      5: { alias: 'pagination', type: Thrift.Type.STRUCT, def: exports.FindMessagesPagination, index: 4 }
    }),
    result: Thrift.Struct.define('findMessagesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.FindMessagesResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  MessageStore.validateRecipients = Thrift.Method.define({
    alias: 'validateRecipients',
    args: Thrift.Struct.define('validateRecipientsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'contacts', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Contact) , index: 1 }
    }),
    result: Thrift.Struct.define('validateRecipientsResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'invalidContactsException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMInvalidContactsException }
    })
  });

  MessageStore.validateContacts = Thrift.Method.define({
    alias: 'validateContacts',
    args: Thrift.Struct.define('validateContactsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'contacts', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Contact) , index: 1 }
    }),
    result: Thrift.Struct.define('validateContactsResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'invalidContactsException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMInvalidContactsException }
    })
  });

  // Define MessageStore Client

  function MessageStoreClient(output) {
    this.output = output;
    this.seqid = 0;
  }

  MessageStoreClient.prototype.sendMessage = function(authenticationToken, message, destination, callback) {
    var mdef = MessageStore.sendMessage;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.message = message;
    args.destination = destination;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.sendMessageToThread = function(authenticationToken, threadId, message, callback) {
    var mdef = MessageStore.sendMessageToThread;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.threadId = threadId;
    args.message = message;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.createMessageThread = function(authenticationToken, spec, callback) {
    var mdef = MessageStore.createMessageThread;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.spec = spec;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.updateParticipants = function(authenticationToken, spec, callback) {
    var mdef = MessageStore.updateParticipants;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.spec = spec;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.reinviteContact = function(authenticationToken, threadId, contact, callback) {
    var mdef = MessageStore.reinviteContact;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.threadId = threadId;
    args.contact = contact;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.renameMessageThread = function(authenticationToken, threadId, threadName, callback) {
    var mdef = MessageStore.renameMessageThread;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.threadId = threadId;
    args.threadName = threadName;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.updateReadStatus = function(authenticationToken, threadId, messageId, callback) {
    var mdef = MessageStore.updateReadStatus;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.threadId = threadId;
    args.messageId = messageId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.updateDeleteStatus = function(authenticationToken, threadId, messageId, callback) {
    var mdef = MessageStore.updateDeleteStatus;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.threadId = threadId;
    args.messageId = messageId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.getMessages = function(authenticationToken, threadId, filter, callback) {
    var mdef = MessageStore.getMessages;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.threadId = threadId;
    args.filter = filter;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.getThreads = function(authenticationToken, callback) {
    var mdef = MessageStore.getThreads;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.getMessageSyncChunk = function(authenticationToken, filter, callback) {
    var mdef = MessageStore.getMessageSyncChunk;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.filter = filter;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.updateBlockStatus = function(authenticationToken, userId, blockStatus, callback) {
    var mdef = MessageStore.updateBlockStatus;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.userId = userId;
    args.blockStatus = blockStatus;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.findMessages = function(authenticationToken, filter, resultSpec, maxMessages, pagination, callback) {
    var mdef = MessageStore.findMessages;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.filter = filter;
    args.resultSpec = resultSpec;
    args.maxMessages = maxMessages;
    args.pagination = pagination;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.validateRecipients = function(authenticationToken, contacts, callback) {
    var mdef = MessageStore.validateRecipients;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.contacts = contacts;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  MessageStoreClient.prototype.validateContacts = function(authenticationToken, contacts, callback) {
    var mdef = MessageStore.validateContacts;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.contacts = contacts;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  exports.MessageStore.Client = MessageStoreClient;

  // Define MessageStore Server

  function MessageStoreServer(service, stransport, Protocol) {
    var methodName;
      this.service = service;
      this.stransport = stransport;
      this.processor = new Thrift.Processor();
      for (methodName in MessageStore) {
        if (service[methodName]) {
          this.processor.addMethod(MessageStore[methodName], service[methodName].bind(service));
        }
      }
      this.stransport.process = function (input, output, noop) {
      var inprot = new Protocol(input);
      var outprot = new Protocol(output);
      this.processor.process(inprot, outprot, noop);
    }.bind(this);
  }

  MessageStoreServer.prototype.start = function () {
    this.stransport.listen();
  };
  MessageStoreServer.prototype.stop = function () {
    this.stransport.close();
  };

  exports.MessageStore.Server = MessageStoreServer;

  return exports;

});
//
// Autogenerated by Thrift Compiler (0.5.0-en-exported)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//


define ('UserStore',['require','thrift','./Types','./Errors'],function (require) {

  // Define types and services

  var Thrift = require('thrift');
  var exports = exports || {};

  var Types = require('./Types');
  var Errors = require('./Errors');


  exports.EDAM_VERSION_MAJOR = 1;

  exports.EDAM_VERSION_MINOR = 28;

  exports.PublicUserInfo = Thrift.Struct.define('PublicUserInfo',  {
    1: { alias: 'userId', type: Thrift.Type.I32 },
    2: { alias: 'shardId', type: Thrift.Type.STRING },
    3: { alias: 'privilege', type: Thrift.Type.I32 },
    7: { alias: 'serviceLevel', type: Thrift.Type.I32 },
    4: { alias: 'username', type: Thrift.Type.STRING },
    5: { alias: 'noteStoreUrl', type: Thrift.Type.STRING },
    6: { alias: 'webApiUrlPrefix', type: Thrift.Type.STRING }
  });

  exports.UserUrls = Thrift.Struct.define('UserUrls',  {
    1: { alias: 'noteStoreUrl', type: Thrift.Type.STRING },
    2: { alias: 'webApiUrlPrefix', type: Thrift.Type.STRING },
    3: { alias: 'userStoreUrl', type: Thrift.Type.STRING },
    4: { alias: 'utilityUrl', type: Thrift.Type.STRING },
    5: { alias: 'messageStoreUrl', type: Thrift.Type.STRING },
    6: { alias: 'userWebSocketUrl', type: Thrift.Type.STRING }
  });

  exports.AuthenticationResult = Thrift.Struct.define('AuthenticationResult',  {
    1: { alias: 'currentTime', type: Thrift.Type.I64 },
    2: { alias: 'authenticationToken', type: Thrift.Type.STRING },
    3: { alias: 'expiration', type: Thrift.Type.I64 },
    4: { alias: 'user', type: Thrift.Type.STRUCT, def: Types.User },
    5: { alias: 'publicUserInfo', type: Thrift.Type.STRUCT, def: exports.PublicUserInfo },
    6: { alias: 'noteStoreUrl', type: Thrift.Type.STRING },
    7: { alias: 'webApiUrlPrefix', type: Thrift.Type.STRING },
    8: { alias: 'secondFactorRequired', type: Thrift.Type.BOOL },
    9: { alias: 'secondFactorDeliveryHint', type: Thrift.Type.STRING },
    10: { alias: 'urls', type: Thrift.Type.STRUCT, def: exports.UserUrls }
  });

  exports.BootstrapSettings = Thrift.Struct.define('BootstrapSettings',  {
    1: { alias: 'serviceHost', type: Thrift.Type.STRING },
    2: { alias: 'marketingUrl', type: Thrift.Type.STRING },
    3: { alias: 'supportUrl', type: Thrift.Type.STRING },
    4: { alias: 'accountEmailDomain', type: Thrift.Type.STRING },
    14: { alias: 'cardscanUrl', type: Thrift.Type.STRING },
    15: { alias: 'announcementsUrl', type: Thrift.Type.STRING },
    5: { alias: 'enableFacebookSharing', type: Thrift.Type.BOOL },
    6: { alias: 'enableGiftSubscriptions', type: Thrift.Type.BOOL },
    7: { alias: 'enableSupportTickets', type: Thrift.Type.BOOL },
    8: { alias: 'enableSharedNotebooks', type: Thrift.Type.BOOL },
    9: { alias: 'enableSingleNoteSharing', type: Thrift.Type.BOOL },
    10: { alias: 'enableSponsoredAccounts', type: Thrift.Type.BOOL },
    11: { alias: 'enableTwitterSharing', type: Thrift.Type.BOOL },
    12: { alias: 'enableLinkedInSharing', type: Thrift.Type.BOOL },
    13: { alias: 'enablePublicNotebooks', type: Thrift.Type.BOOL },
    16: { alias: 'enableGoogle', type: Thrift.Type.BOOL }
  });

  exports.BootstrapProfile = Thrift.Struct.define('BootstrapProfile',  {
    1: { alias: 'name', type: Thrift.Type.STRING },
    2: { alias: 'settings', type: Thrift.Type.STRUCT, def: exports.BootstrapSettings }
  });

  exports.BootstrapInfo = Thrift.Struct.define('BootstrapInfo',  {
    1: { alias: 'profiles', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.BootstrapProfile)  }
  });

  exports.PushNotificationCredentials = Thrift.Struct.define('PushNotificationCredentials',  {
    1: { alias: 'iosDeviceToken', type: Thrift.Type.BINARY },
    2: { alias: 'gcmRegistrationId', type: Thrift.Type.STRING }
  });

  exports.RegisterForSyncPushNotificationsResult = Thrift.Struct.define('RegisterForSyncPushNotificationsResult',  {
    1: { alias: 'sharedSecret', type: Thrift.Type.BINARY }
  });

  var UserStore = exports.UserStore = {};

  UserStore.checkVersion = Thrift.Method.define({
    alias: 'checkVersion',
    args: Thrift.Struct.define('checkVersionArgs', {
      1: { alias: 'clientName', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'edamVersionMajor', type: Thrift.Type.I16, index: 1 },
      3: { alias: 'edamVersionMinor', type: Thrift.Type.I16, index: 2 }
    }),
    result: Thrift.Struct.define('checkVersionResult', {
      0: { alias: 'returnValue',type: Thrift.Type.BOOL }
    })
  });

  UserStore.getBootstrapInfo = Thrift.Method.define({
    alias: 'getBootstrapInfo',
    args: Thrift.Struct.define('getBootstrapInfoArgs', {
      1: { alias: 'locale', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getBootstrapInfoResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.BootstrapInfo }
    })
  });

  UserStore.authenticate = Thrift.Method.define({
    alias: 'authenticate',
    args: Thrift.Struct.define('authenticateArgs', {
      1: { alias: 'username', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'password', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'consumerKey', type: Thrift.Type.STRING, index: 2 },
      4: { alias: 'consumerSecret', type: Thrift.Type.STRING, index: 3 },
      5: { alias: 'supportsTwoFactor', type: Thrift.Type.BOOL, index: 4 }
    }),
    result: Thrift.Struct.define('authenticateResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.AuthenticationResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.authenticateLongSession = Thrift.Method.define({
    alias: 'authenticateLongSession',
    args: Thrift.Struct.define('authenticateLongSessionArgs', {
      1: { alias: 'username', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'password', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'consumerKey', type: Thrift.Type.STRING, index: 2 },
      4: { alias: 'consumerSecret', type: Thrift.Type.STRING, index: 3 },
      5: { alias: 'deviceIdentifier', type: Thrift.Type.STRING, index: 4 },
      6: { alias: 'deviceDescription', type: Thrift.Type.STRING, index: 5 },
      7: { alias: 'supportsTwoFactor', type: Thrift.Type.BOOL, index: 6 }
    }),
    result: Thrift.Struct.define('authenticateLongSessionResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.AuthenticationResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.completeTwoFactorAuthentication = Thrift.Method.define({
    alias: 'completeTwoFactorAuthentication',
    args: Thrift.Struct.define('completeTwoFactorAuthenticationArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'oneTimeCode', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'deviceIdentifier', type: Thrift.Type.STRING, index: 2 },
      4: { alias: 'deviceDescription', type: Thrift.Type.STRING, index: 3 }
    }),
    result: Thrift.Struct.define('completeTwoFactorAuthenticationResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.AuthenticationResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.revokeLongSession = Thrift.Method.define({
    alias: 'revokeLongSession',
    args: Thrift.Struct.define('revokeLongSessionArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('revokeLongSessionResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.authenticateToBusiness = Thrift.Method.define({
    alias: 'authenticateToBusiness',
    args: Thrift.Struct.define('authenticateToBusinessArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('authenticateToBusinessResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.AuthenticationResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.refreshAuthentication = Thrift.Method.define({
    alias: 'refreshAuthentication',
    args: Thrift.Struct.define('refreshAuthenticationArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('refreshAuthenticationResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.AuthenticationResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.getUser = Thrift.Method.define({
    alias: 'getUser',
    args: Thrift.Struct.define('getUserArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getUserResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.User },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.getPublicUserInfo = Thrift.Method.define({
    alias: 'getPublicUserInfo',
    args: Thrift.Struct.define('getPublicUserInfoArgs', {
      1: { alias: 'username', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getPublicUserInfoResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.PublicUserInfo },
      1: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  UserStore.getPremiumInfo = Thrift.Method.define({
    alias: 'getPremiumInfo',
    args: Thrift.Struct.define('getPremiumInfoArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getPremiumInfoResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.PremiumInfo },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.getSubscriptionInfo = Thrift.Method.define({
    alias: 'getSubscriptionInfo',
    args: Thrift.Struct.define('getSubscriptionInfoArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getSubscriptionInfoResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.SubscriptionInfo },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.getNoteStoreUrl = Thrift.Method.define({
    alias: 'getNoteStoreUrl',
    args: Thrift.Struct.define('getNoteStoreUrlArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getNoteStoreUrlResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRING },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.getUserUrls = Thrift.Method.define({
    alias: 'getUserUrls',
    args: Thrift.Struct.define('getUserUrlsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getUserUrlsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.UserUrls },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.inviteToBusiness = Thrift.Method.define({
    alias: 'inviteToBusiness',
    args: Thrift.Struct.define('inviteToBusinessArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'emailAddress', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('inviteToBusinessResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.removeFromBusiness = Thrift.Method.define({
    alias: 'removeFromBusiness',
    args: Thrift.Struct.define('removeFromBusinessArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'emailAddress', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('removeFromBusinessResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  UserStore.updateBusinessUserIdentifier = Thrift.Method.define({
    alias: 'updateBusinessUserIdentifier',
    args: Thrift.Struct.define('updateBusinessUserIdentifierArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'oldEmailAddress', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'newEmailAddress', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('updateBusinessUserIdentifierResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  UserStore.listBusinessUsers = Thrift.Method.define({
    alias: 'listBusinessUsers',
    args: Thrift.Struct.define('listBusinessUsersArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('listBusinessUsersResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.UserProfile)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.listBusinessInvitations = Thrift.Method.define({
    alias: 'listBusinessInvitations',
    args: Thrift.Struct.define('listBusinessInvitationsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'includeRequestedInvitations', type: Thrift.Type.BOOL, index: 1 }
    }),
    result: Thrift.Struct.define('listBusinessInvitationsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.BusinessInvitation)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  UserStore.registerForSyncPushNotifications = Thrift.Method.define({
    alias: 'registerForSyncPushNotifications',
    args: Thrift.Struct.define('registerForSyncPushNotificationsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'credentials', type: Thrift.Type.STRUCT, def: exports.PushNotificationCredentials, index: 1 }
    }),
    result: Thrift.Struct.define('registerForSyncPushNotificationsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.RegisterForSyncPushNotificationsResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  UserStore.unregisterForSyncPushNotifications = Thrift.Method.define({
    alias: 'unregisterForSyncPushNotifications',
    args: Thrift.Struct.define('unregisterForSyncPushNotificationsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('unregisterForSyncPushNotificationsResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  UserStore.createSessionAuthenticationToken = Thrift.Method.define({
    alias: 'createSessionAuthenticationToken',
    args: Thrift.Struct.define('createSessionAuthenticationTokenArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('createSessionAuthenticationTokenResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRING },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  UserStore.getAccountLimits = Thrift.Method.define({
    alias: 'getAccountLimits',
    args: Thrift.Struct.define('getAccountLimitsArgs', {
      1: { alias: 'serviceLevel', type: Thrift.Type.I32, index: 0 }
    }),
    result: Thrift.Struct.define('getAccountLimitsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.AccountLimits },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  // Define UserStore Client

  function UserStoreClient(output) {
    this.output = output;
    this.seqid = 0;
  }

  UserStoreClient.prototype.checkVersion = function(clientName, edamVersionMajor, edamVersionMinor, callback) {
    var mdef = UserStore.checkVersion;
    var args = new mdef.args();
    args.clientName = clientName;
    args.edamVersionMajor = edamVersionMajor;
    args.edamVersionMinor = edamVersionMinor;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.getBootstrapInfo = function(locale, callback) {
    var mdef = UserStore.getBootstrapInfo;
    var args = new mdef.args();
    args.locale = locale;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.authenticate = function(username, password, consumerKey, consumerSecret, supportsTwoFactor, callback) {
    var mdef = UserStore.authenticate;
    var args = new mdef.args();
    args.username = username;
    args.password = password;
    args.consumerKey = consumerKey;
    args.consumerSecret = consumerSecret;
    args.supportsTwoFactor = supportsTwoFactor;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.authenticateLongSession = function(username, password, consumerKey, consumerSecret, deviceIdentifier, deviceDescription, supportsTwoFactor, callback) {
    var mdef = UserStore.authenticateLongSession;
    var args = new mdef.args();
    args.username = username;
    args.password = password;
    args.consumerKey = consumerKey;
    args.consumerSecret = consumerSecret;
    args.deviceIdentifier = deviceIdentifier;
    args.deviceDescription = deviceDescription;
    args.supportsTwoFactor = supportsTwoFactor;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.completeTwoFactorAuthentication = function(authenticationToken, oneTimeCode, deviceIdentifier, deviceDescription, callback) {
    var mdef = UserStore.completeTwoFactorAuthentication;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.oneTimeCode = oneTimeCode;
    args.deviceIdentifier = deviceIdentifier;
    args.deviceDescription = deviceDescription;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.revokeLongSession = function(authenticationToken, callback) {
    var mdef = UserStore.revokeLongSession;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.authenticateToBusiness = function(authenticationToken, callback) {
    var mdef = UserStore.authenticateToBusiness;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.refreshAuthentication = function(authenticationToken, callback) {
    var mdef = UserStore.refreshAuthentication;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.getUser = function(authenticationToken, callback) {
    var mdef = UserStore.getUser;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.getPublicUserInfo = function(username, callback) {
    var mdef = UserStore.getPublicUserInfo;
    var args = new mdef.args();
    args.username = username;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.getPremiumInfo = function(authenticationToken, callback) {
    var mdef = UserStore.getPremiumInfo;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.getSubscriptionInfo = function(authenticationToken, callback) {
    var mdef = UserStore.getSubscriptionInfo;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.getNoteStoreUrl = function(authenticationToken, callback) {
    var mdef = UserStore.getNoteStoreUrl;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.getUserUrls = function(authenticationToken, callback) {
    var mdef = UserStore.getUserUrls;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.inviteToBusiness = function(authenticationToken, emailAddress, callback) {
    var mdef = UserStore.inviteToBusiness;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.emailAddress = emailAddress;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.removeFromBusiness = function(authenticationToken, emailAddress, callback) {
    var mdef = UserStore.removeFromBusiness;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.emailAddress = emailAddress;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.updateBusinessUserIdentifier = function(authenticationToken, oldEmailAddress, newEmailAddress, callback) {
    var mdef = UserStore.updateBusinessUserIdentifier;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.oldEmailAddress = oldEmailAddress;
    args.newEmailAddress = newEmailAddress;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.listBusinessUsers = function(authenticationToken, callback) {
    var mdef = UserStore.listBusinessUsers;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.listBusinessInvitations = function(authenticationToken, includeRequestedInvitations, callback) {
    var mdef = UserStore.listBusinessInvitations;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.includeRequestedInvitations = includeRequestedInvitations;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.registerForSyncPushNotifications = function(authenticationToken, credentials, callback) {
    var mdef = UserStore.registerForSyncPushNotifications;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.credentials = credentials;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.unregisterForSyncPushNotifications = function(authenticationToken, callback) {
    var mdef = UserStore.unregisterForSyncPushNotifications;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.createSessionAuthenticationToken = function(authenticationToken, callback) {
    var mdef = UserStore.createSessionAuthenticationToken;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UserStoreClient.prototype.getAccountLimits = function(serviceLevel, callback) {
    var mdef = UserStore.getAccountLimits;
    var args = new mdef.args();
    args.serviceLevel = serviceLevel;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  exports.UserStore.Client = UserStoreClient;

  // Define UserStore Server

  function UserStoreServer(service, stransport, Protocol) {
    var methodName;
      this.service = service;
      this.stransport = stransport;
      this.processor = new Thrift.Processor();
      for (methodName in UserStore) {
        if (service[methodName]) {
          this.processor.addMethod(UserStore[methodName], service[methodName].bind(service));
        }
      }
      this.stransport.process = function (input, output, noop) {
      var inprot = new Protocol(input);
      var outprot = new Protocol(output);
      this.processor.process(inprot, outprot, noop);
    }.bind(this);
  }

  UserStoreServer.prototype.start = function () {
    this.stransport.listen();
  };
  UserStoreServer.prototype.stop = function () {
    this.stransport.close();
  };

  exports.UserStore.Server = UserStoreServer;

  return exports;

});
//
// Autogenerated by Thrift Compiler (0.5.0-en-exported)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//


define ('NoteStore',['require','thrift','./UserStore','./Types','./Errors','./Limits'],function (require) {

  // Define types and services

  var Thrift = require('thrift');
  var exports = exports || {};

  var UserStore = require('./UserStore');
  var Types = require('./Types');
  var Errors = require('./Errors');
  var Limits = require('./Limits');


  exports.UserSetting = {
    'RECEIVE_REMINDER_EMAIL' : 1,
    'TIMEZONE' : 2
  };

  exports.ShareRelationshipPrivilegeLevel = {
    'READ_NOTEBOOK' : 0,
    'READ_NOTEBOOK_PLUS_ACTIVITY' : 10,
    'MODIFY_NOTEBOOK_PLUS_ACTIVITY' : 20,
    'FULL_ACCESS' : 30
  };

  exports.SyncState = Thrift.Struct.define('SyncState',  {
    1: { alias: 'currentTime', type: Thrift.Type.I64 },
    2: { alias: 'fullSyncBefore', type: Thrift.Type.I64 },
    3: { alias: 'updateCount', type: Thrift.Type.I32 },
    4: { alias: 'uploaded', type: Thrift.Type.I64 },
    5: { alias: 'userLastUpdated', type: Thrift.Type.I64 },
    6: { alias: 'userMaxMessageEventId', type: Thrift.Type.I64 },
    7: { alias: 'businessSummaryUpdated', type: Thrift.Type.I64 }
  });

  exports.Preferences = Thrift.Struct.define('Preferences',  {
    1: { alias: 'updateSequenceNum', type: Thrift.Type.I32 },
    2: { alias: 'preferences', type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.LIST, Thrift.List.define(Thrift.Type.STRING) )  }
  });

  exports.SyncChunk = Thrift.Struct.define('SyncChunk',  {
    1: { alias: 'currentTime', type: Thrift.Type.I64 },
    2: { alias: 'chunkHighUSN', type: Thrift.Type.I32 },
    3: { alias: 'updateCount', type: Thrift.Type.I32 },
    4: { alias: 'notes', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Note)  },
    5: { alias: 'notebooks', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Notebook)  },
    6: { alias: 'tags', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Tag)  },
    7: { alias: 'searches', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.SavedSearch)  },
    8: { alias: 'resources', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Resource)  },
    9: { alias: 'expungedNotes', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    10: { alias: 'expungedNotebooks', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    11: { alias: 'expungedTags', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    12: { alias: 'expungedSearches', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    13: { alias: 'linkedNotebooks', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.LinkedNotebook)  },
    14: { alias: 'expungedLinkedNotebooks', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    15: { alias: 'preferences', type: Thrift.Type.STRUCT, def: exports.Preferences }
  });

  exports.SyncChunkFilter = Thrift.Struct.define('SyncChunkFilter',  {
    1: { alias: 'includeNotes', type: Thrift.Type.BOOL },
    2: { alias: 'includeNoteResources', type: Thrift.Type.BOOL },
    3: { alias: 'includeNoteAttributes', type: Thrift.Type.BOOL },
    4: { alias: 'includeNotebooks', type: Thrift.Type.BOOL },
    5: { alias: 'includeTags', type: Thrift.Type.BOOL },
    6: { alias: 'includeSearches', type: Thrift.Type.BOOL },
    7: { alias: 'includeResources', type: Thrift.Type.BOOL },
    8: { alias: 'includeLinkedNotebooks', type: Thrift.Type.BOOL },
    9: { alias: 'includeExpunged', type: Thrift.Type.BOOL },
    10: { alias: 'includeNoteApplicationDataFullMap', type: Thrift.Type.BOOL },
    12: { alias: 'includeResourceApplicationDataFullMap', type: Thrift.Type.BOOL },
    13: { alias: 'includeNoteResourceApplicationDataFullMap', type: Thrift.Type.BOOL },
    14: { alias: 'includePreferences', type: Thrift.Type.BOOL },
    17: { alias: 'includedSharedNotes', type: Thrift.Type.BOOL },
    16: { alias: 'omitSharedNotebooks', type: Thrift.Type.BOOL },
    11: { alias: 'requireNoteContentClass', type: Thrift.Type.STRING },
    15: { alias: 'notebookGuids', type: Thrift.Type.SET, def: Thrift.Set.define(Thrift.Type.STRING) }
  });

  exports.NoteFilter = Thrift.Struct.define('NoteFilter',  {
    1: { alias: 'order', type: Thrift.Type.I32 },
    2: { alias: 'ascending', type: Thrift.Type.BOOL },
    3: { alias: 'words', type: Thrift.Type.STRING },
    4: { alias: 'notebookGuid', type: Thrift.Type.STRING },
    5: { alias: 'tagGuids', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    6: { alias: 'timeZone', type: Thrift.Type.STRING },
    7: { alias: 'inactive', type: Thrift.Type.BOOL },
    8: { alias: 'emphasized', type: Thrift.Type.STRING },
    9: { alias: 'includeAllReadableNotebooks', type: Thrift.Type.BOOL }
  });

  exports.NoteList = Thrift.Struct.define('NoteList',  {
    1: { alias: 'startIndex', type: Thrift.Type.I32 },
    2: { alias: 'totalNotes', type: Thrift.Type.I32 },
    3: { alias: 'notes', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Note)  },
    4: { alias: 'stoppedWords', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    5: { alias: 'searchedWords', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    6: { alias: 'updateCount', type: Thrift.Type.I32 }
  });

  exports.NoteMetadata = Thrift.Struct.define('NoteMetadata',  {
    1: { alias: 'guid', type: Thrift.Type.STRING },
    2: { alias: 'title', type: Thrift.Type.STRING },
    5: { alias: 'contentLength', type: Thrift.Type.I32 },
    6: { alias: 'created', type: Thrift.Type.I64 },
    7: { alias: 'updated', type: Thrift.Type.I64 },
    8: { alias: 'deleted', type: Thrift.Type.I64 },
    10: { alias: 'updateSequenceNum', type: Thrift.Type.I32 },
    11: { alias: 'notebookGuid', type: Thrift.Type.STRING },
    12: { alias: 'tagGuids', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    14: { alias: 'attributes', type: Thrift.Type.STRUCT, def: Types.NoteAttributes },
    20: { alias: 'largestResourceMime', type: Thrift.Type.STRING },
    21: { alias: 'largestResourceSize', type: Thrift.Type.I32 }
  });

  exports.NotesMetadataList = Thrift.Struct.define('NotesMetadataList',  {
    1: { alias: 'startIndex', type: Thrift.Type.I32 },
    2: { alias: 'totalNotes', type: Thrift.Type.I32 },
    3: { alias: 'notes', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.NoteMetadata)  },
    4: { alias: 'stoppedWords', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    5: { alias: 'searchedWords', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    6: { alias: 'updateCount', type: Thrift.Type.I32 }
  });

  exports.NotesMetadataResultSpec = Thrift.Struct.define('NotesMetadataResultSpec',  {
    2: { alias: 'includeTitle', type: Thrift.Type.BOOL },
    5: { alias: 'includeContentLength', type: Thrift.Type.BOOL },
    6: { alias: 'includeCreated', type: Thrift.Type.BOOL },
    7: { alias: 'includeUpdated', type: Thrift.Type.BOOL },
    8: { alias: 'includeDeleted', type: Thrift.Type.BOOL },
    10: { alias: 'includeUpdateSequenceNum', type: Thrift.Type.BOOL },
    11: { alias: 'includeNotebookGuid', type: Thrift.Type.BOOL },
    12: { alias: 'includeTagGuids', type: Thrift.Type.BOOL },
    14: { alias: 'includeAttributes', type: Thrift.Type.BOOL },
    20: { alias: 'includeLargestResourceMime', type: Thrift.Type.BOOL },
    21: { alias: 'includeLargestResourceSize', type: Thrift.Type.BOOL }
  });

  exports.NoteCollectionCounts = Thrift.Struct.define('NoteCollectionCounts',  {
    1: { alias: 'notebookCounts', type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.I32 )  },
    2: { alias: 'tagCounts', type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.I32 )  },
    3: { alias: 'trashCount', type: Thrift.Type.I32 }
  });

  exports.NoteResultSpec = Thrift.Struct.define('NoteResultSpec',  {
    1: { alias: 'includeContent', type: Thrift.Type.BOOL },
    2: { alias: 'includeResourcesData', type: Thrift.Type.BOOL },
    3: { alias: 'includeResourcesRecognition', type: Thrift.Type.BOOL },
    4: { alias: 'includeResourcesAlternateData', type: Thrift.Type.BOOL },
    5: { alias: 'includeSharedNotes', type: Thrift.Type.BOOL }
  });

  exports.AdImpressions = Thrift.Struct.define('AdImpressions',  {
    1: { alias: 'adId', type: Thrift.Type.I32 },
    2: { alias: 'impressionCount', type: Thrift.Type.I32 },
    3: { alias: 'impressionTime', type: Thrift.Type.I32 }
  });

  exports.AdParameters = Thrift.Struct.define('AdParameters',  {
    2: { alias: 'clientLanguage', type: Thrift.Type.STRING },
    4: { alias: 'impressions', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.AdImpressions)  },
    5: { alias: 'supportHtml', type: Thrift.Type.BOOL },
    6: { alias: 'clientProperties', type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.STRING )  }
  });

  exports.NoteEmailParameters = Thrift.Struct.define('NoteEmailParameters',  {
    1: { alias: 'guid', type: Thrift.Type.STRING },
    2: { alias: 'note', type: Thrift.Type.STRUCT, def: Types.Note },
    3: { alias: 'toAddresses', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    4: { alias: 'ccAddresses', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    5: { alias: 'subject', type: Thrift.Type.STRING },
    6: { alias: 'message', type: Thrift.Type.STRING }
  });

  exports.NoteVersionId = Thrift.Struct.define('NoteVersionId',  {
    1: { alias: 'updateSequenceNum', type: Thrift.Type.I32 },
    2: { alias: 'updated', type: Thrift.Type.I64 },
    3: { alias: 'saved', type: Thrift.Type.I64 },
    4: { alias: 'title', type: Thrift.Type.STRING },
    5: { alias: 'lastEditorId', type: Thrift.Type.I32 }
  });

  exports.ClientUsageMetrics = Thrift.Struct.define('ClientUsageMetrics',  {
    1: { alias: 'sessions', type: Thrift.Type.I32 },
    2: { alias: 'subjectConsumerKey', type: Thrift.Type.STRING },
    3: { alias: 'subjectConsumerSecret', type: Thrift.Type.STRING }
  });

  exports.RelatedQuery = Thrift.Struct.define('RelatedQuery',  {
    1: { alias: 'noteGuid', type: Thrift.Type.STRING },
    2: { alias: 'plainText', type: Thrift.Type.STRING },
    3: { alias: 'filter', type: Thrift.Type.STRUCT, def: exports.NoteFilter },
    4: { alias: 'referenceUri', type: Thrift.Type.STRING },
    5: { alias: 'context', type: Thrift.Type.STRING },
    6: { alias: 'cacheKey', type: Thrift.Type.STRING }
  });

  exports.RelatedResult = Thrift.Struct.define('RelatedResult',  {
    1: { alias: 'notes', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Note)  },
    2: { alias: 'notebooks', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Notebook)  },
    3: { alias: 'tags', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Tag)  },
    4: { alias: 'containingNotebooks', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.NotebookDescriptor)  },
    5: { alias: 'debugInfo', type: Thrift.Type.STRING },
    6: { alias: 'experts', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.UserProfile)  },
    7: { alias: 'relatedContent', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.RelatedContent)  },
    8: { alias: 'cacheKey', type: Thrift.Type.STRING },
    9: { alias: 'cacheExpires', type: Thrift.Type.I32 }
  });

  exports.RelatedResultSpec = Thrift.Struct.define('RelatedResultSpec',  {
    1: { alias: 'maxNotes', type: Thrift.Type.I32 },
    2: { alias: 'maxNotebooks', type: Thrift.Type.I32 },
    3: { alias: 'maxTags', type: Thrift.Type.I32 },
    4: { alias: 'writableNotebooksOnly', type: Thrift.Type.BOOL },
    5: { alias: 'includeContainingNotebooks', type: Thrift.Type.BOOL },
    6: { alias: 'includeDebugInfo', type: Thrift.Type.BOOL },
    7: { alias: 'maxExperts', type: Thrift.Type.I32 },
    8: { alias: 'maxRelatedContent', type: Thrift.Type.I32 },
    9: { alias: 'relatedContentTypes', type: Thrift.Type.SET, def: Thrift.Set.define(Thrift.Type.I32) }
  });

  exports.SearchSuggestionQuery = Thrift.Struct.define('SearchSuggestionQuery',  {
    1: { alias: 'prefix', type: Thrift.Type.STRING },
    2: { alias: 'contextFilter', type: Thrift.Type.STRUCT, def: exports.NoteFilter }
  });

  exports.SearchSuggestionResultSpec = Thrift.Struct.define('SearchSuggestionResultSpec',  {
    1: { alias: 'maxTypeAheadSuggestions', type: Thrift.Type.I32 }
  });

  exports.SearchSuggestion = Thrift.Struct.define('SearchSuggestion',  {
    1: { alias: 'suggestionText', type: Thrift.Type.STRING }
  });

  exports.SearchSuggestionResult = Thrift.Struct.define('SearchSuggestionResult',  {
    1: { alias: 'typeAheadSuggestions', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.SearchSuggestion)  }
  });

  exports.TimeZone = Thrift.Struct.define('TimeZone',  {
    1: { alias: 'id', type: Thrift.Type.STRING },
    2: { alias: 'displayName', type: Thrift.Type.STRING },
    3: { alias: 'rawUTCOffsetMillis', type: Thrift.Type.I32 },
    4: { alias: 'dstSavingsAdjustmentMillis', type: Thrift.Type.I32 },
    5: { alias: 'nextEnterDaylightSavings', type: Thrift.Type.I64 },
    6: { alias: 'nextLeaveDaylightSavings', type: Thrift.Type.I64 }
  });

  exports.TimeZoneSpec = Thrift.Struct.define('TimeZoneSpec',  {
    1: { alias: 'id', type: Thrift.Type.STRING },
    2: { alias: 'rawUTCOffsetMillis', type: Thrift.Type.I32 },
    3: { alias: 'dstSavingsAdjustmentMillis', type: Thrift.Type.I32 },
    4: { alias: 'nextEnterDaylightSavings', type: Thrift.Type.I64 },
    5: { alias: 'nextLeaveDaylightSavings', type: Thrift.Type.I64 }
  });

  exports.ContactsQuery = Thrift.Struct.define('ContactsQuery',  {
    1: { alias: 'maxEntries', type: Thrift.Type.I32 },
    2: { alias: 'prefix', type: Thrift.Type.STRING }
  });

  exports.BusinessQuery = Thrift.Struct.define('BusinessQuery',  {
    1: { alias: 'filter', type: Thrift.Type.STRUCT, def: exports.NoteFilter },
    2: { alias: 'numExperts', type: Thrift.Type.I32 },
    3: { alias: 'includeNotebooks', type: Thrift.Type.BOOL },
    4: { alias: 'includeNotesCounts', type: Thrift.Type.BOOL }
  });

  exports.BusinessQueryResult = Thrift.Struct.define('BusinessQueryResult',  {
    1: { alias: 'totalNotebooks', type: Thrift.Type.I32 },
    2: { alias: 'totalNotesByNotebook', type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.I32 )  },
    3: { alias: 'experts', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.UserProfile)  },
    4: { alias: 'matchingNotebooks', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Notebook)  }
  });

  exports.NoteLockStatus = Thrift.Struct.define('NoteLockStatus',  {
    1: { alias: 'noteUpdateSequenceNumber', type: Thrift.Type.I32 },
    2: { alias: 'lockHolderUserId', type: Thrift.Type.I32 },
    3: { alias: 'lockRenewBy', type: Thrift.Type.I64 },
    4: { alias: 'viewingUserIds', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I32)  },
    5: { alias: 'viewIdleExpiration', type: Thrift.Type.I32 },
    6: { alias: 'unknownUsers', type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.I32, Thrift.Type.STRUCT, Types.Contact)  }
  });

  exports.UpdateNoteIfUsnMatchesResult = Thrift.Struct.define('UpdateNoteIfUsnMatchesResult',  {
    1: { alias: 'note', type: Thrift.Type.STRUCT, def: Types.Note },
    2: { alias: 'updated', type: Thrift.Type.BOOL }
  });

  exports.ShareRelationshipRestrictions = Thrift.Struct.define('ShareRelationshipRestrictions',  {
    1: { alias: 'noSetReadOnly', type: Thrift.Type.BOOL },
    2: { alias: 'noSetReadPlusActivity', type: Thrift.Type.BOOL },
    3: { alias: 'noSetModify', type: Thrift.Type.BOOL },
    4: { alias: 'noSetFullAccess', type: Thrift.Type.BOOL }
  });

  exports.InvitationShareRelationship = Thrift.Struct.define('InvitationShareRelationship',  {
    1: { alias: 'displayName', type: Thrift.Type.STRING },
    2: { alias: 'recipientUserIdentity', type: Thrift.Type.STRUCT, def: Types.UserIdentity },
    3: { alias: 'privilege', type: Thrift.Type.I32 },
    4: { alias: 'allowPreview', type: Thrift.Type.BOOL },
    5: { alias: 'sharerUserId', type: Thrift.Type.I32 }
  });

  exports.MemberShareRelationship = Thrift.Struct.define('MemberShareRelationship',  {
    1: { alias: 'displayName', type: Thrift.Type.STRING },
    2: { alias: 'recipientUserId', type: Thrift.Type.I32 },
    3: { alias: 'bestPrivilege', type: Thrift.Type.I32 },
    4: { alias: 'individualPrivilege', type: Thrift.Type.I32 },
    5: { alias: 'restrictions', type: Thrift.Type.STRUCT, def: exports.ShareRelationshipRestrictions },
    6: { alias: 'sharerUserId', type: Thrift.Type.I32 }
  });

  exports.ShareRelationships = Thrift.Struct.define('ShareRelationships',  {
    1: { alias: 'invitations', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.InvitationShareRelationship)  },
    2: { alias: 'memberships', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.MemberShareRelationship)  },
    3: { alias: 'invitationRestrictions', type: Thrift.Type.STRUCT, def: exports.ShareRelationshipRestrictions }
  });

  exports.ManageNotebookSharesParameters = Thrift.Struct.define('ManageNotebookSharesParameters',  {
    1: { alias: 'notebookGuid', type: Thrift.Type.STRING },
    2: { alias: 'inviteMessage', type: Thrift.Type.STRING },
    3: { alias: 'membershipsToUpdate', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.MemberShareRelationship)  },
    4: { alias: 'invitationsToCreateOrUpdate', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.InvitationShareRelationship)  },
    5: { alias: 'unshares', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.UserIdentity)  }
  });

  exports.ManageNotebookSharesError = Thrift.Struct.define('ManageNotebookSharesError',  {
    1: { alias: 'userIdentity', type: Thrift.Type.STRUCT, def: Types.UserIdentity },
    2: { alias: 'userException', type: Thrift.Type.STRUCT },
    3: { alias: 'notFoundException', type: Thrift.Type.STRUCT }
  });

  exports.ManageNotebookSharesResult = Thrift.Struct.define('ManageNotebookSharesResult',  {
    1: { alias: 'errors', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.ManageNotebookSharesError)  }
  });

  exports.SharedNoteTemplate = Thrift.Struct.define('SharedNoteTemplate',  {
    1: { alias: 'noteGuid', type: Thrift.Type.STRING },
    4: { alias: 'recipientThreadId', type: Thrift.Type.I64 },
    2: { alias: 'recipientContacts', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Contact)  },
    3: { alias: 'privilege', type: Thrift.Type.I32 }
  });

  exports.NotebookShareTemplate = Thrift.Struct.define('NotebookShareTemplate',  {
    1: { alias: 'notebookGuid', type: Thrift.Type.STRING },
    4: { alias: 'recipientThreadId', type: Thrift.Type.I64 },
    2: { alias: 'recipientContacts', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Contact)  },
    3: { alias: 'privilege', type: Thrift.Type.I32 }
  });

  exports.CreateOrUpdateNotebookSharesResult = Thrift.Struct.define('CreateOrUpdateNotebookSharesResult',  {
    1: { alias: 'updateSequenceNum', type: Thrift.Type.I32 },
    2: { alias: 'matchingShares', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.SharedNotebook)  }
  });

  exports.NoteShareRelationshipRestrictions = Thrift.Struct.define('NoteShareRelationshipRestrictions',  {
    1: { alias: 'noSetReadNote', type: Thrift.Type.BOOL },
    2: { alias: 'noSetModifyNote', type: Thrift.Type.BOOL },
    3: { alias: 'noSetFullAccess', type: Thrift.Type.BOOL }
  });

  exports.NoteMemberShareRelationship = Thrift.Struct.define('NoteMemberShareRelationship',  {
    1: { alias: 'displayName', type: Thrift.Type.STRING },
    2: { alias: 'recipientUserId', type: Thrift.Type.I32 },
    3: { alias: 'privilege', type: Thrift.Type.I32 },
    4: { alias: 'restrictions', type: Thrift.Type.STRUCT, def: exports.NoteShareRelationshipRestrictions },
    5: { alias: 'sharerUserId', type: Thrift.Type.I32 }
  });

  exports.NoteInvitationShareRelationship = Thrift.Struct.define('NoteInvitationShareRelationship',  {
    1: { alias: 'displayName', type: Thrift.Type.STRING },
    2: { alias: 'recipientIdentityId', type: Thrift.Type.I64 },
    3: { alias: 'privilege', type: Thrift.Type.I32 },
    5: { alias: 'sharerUserId', type: Thrift.Type.I32 }
  });

  exports.NoteShareRelationships = Thrift.Struct.define('NoteShareRelationships',  {
    1: { alias: 'invitations', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.NoteInvitationShareRelationship)  },
    2: { alias: 'memberships', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.NoteMemberShareRelationship)  },
    3: { alias: 'invitationRestrictions', type: Thrift.Type.STRUCT, def: exports.NoteShareRelationshipRestrictions }
  });

  exports.ManageNoteSharesParameters = Thrift.Struct.define('ManageNoteSharesParameters',  {
    1: { alias: 'noteGuid', type: Thrift.Type.STRING },
    2: { alias: 'membershipsToUpdate', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.NoteMemberShareRelationship)  },
    3: { alias: 'invitationsToUpdate', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.NoteInvitationShareRelationship)  },
    4: { alias: 'membershipsToUnshare', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I32)  },
    5: { alias: 'invitationsToUnshare', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I64)  }
  });

  exports.ManageNoteSharesError = Thrift.Struct.define('ManageNoteSharesError',  {
    1: { alias: 'identityID', type: Thrift.Type.I64 },
    2: { alias: 'userID', type: Thrift.Type.I32 },
    3: { alias: 'userException', type: Thrift.Type.STRUCT },
    4: { alias: 'notFoundException', type: Thrift.Type.STRUCT }
  });

  exports.ManageNoteSharesResult = Thrift.Struct.define('ManageNoteSharesResult',  {
    1: { alias: 'errors', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.ManageNoteSharesError)  }
  });

  var NoteStore = exports.NoteStore = {};

  NoteStore.getSyncState = Thrift.Method.define({
    alias: 'getSyncState',
    args: Thrift.Struct.define('getSyncStateArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getSyncStateResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.SyncState },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getSyncStateWithMetrics = Thrift.Method.define({
    alias: 'getSyncStateWithMetrics',
    args: Thrift.Struct.define('getSyncStateWithMetricsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'clientMetrics', type: Thrift.Type.STRUCT, def: exports.ClientUsageMetrics, index: 1 }
    }),
    result: Thrift.Struct.define('getSyncStateWithMetricsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.SyncState },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getSyncChunk = Thrift.Method.define({
    alias: 'getSyncChunk',
    args: Thrift.Struct.define('getSyncChunkArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'afterUSN', type: Thrift.Type.I32, index: 1 },
      3: { alias: 'maxEntries', type: Thrift.Type.I32, index: 2 },
      4: { alias: 'fullSyncOnly', type: Thrift.Type.BOOL, index: 3 }
    }),
    result: Thrift.Struct.define('getSyncChunkResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.SyncChunk },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getFilteredSyncChunk = Thrift.Method.define({
    alias: 'getFilteredSyncChunk',
    args: Thrift.Struct.define('getFilteredSyncChunkArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'afterUSN', type: Thrift.Type.I32, index: 1 },
      3: { alias: 'maxEntries', type: Thrift.Type.I32, index: 2 },
      4: { alias: 'filter', type: Thrift.Type.STRUCT, def: exports.SyncChunkFilter, index: 3 }
    }),
    result: Thrift.Struct.define('getFilteredSyncChunkResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.SyncChunk },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getLinkedNotebookSyncState = Thrift.Method.define({
    alias: 'getLinkedNotebookSyncState',
    args: Thrift.Struct.define('getLinkedNotebookSyncStateArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'linkedNotebook', type: Thrift.Type.STRUCT, def: Types.LinkedNotebook, index: 1 }
    }),
    result: Thrift.Struct.define('getLinkedNotebookSyncStateResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.SyncState },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getLinkedNotebookSyncChunk = Thrift.Method.define({
    alias: 'getLinkedNotebookSyncChunk',
    args: Thrift.Struct.define('getLinkedNotebookSyncChunkArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'linkedNotebook', type: Thrift.Type.STRUCT, def: Types.LinkedNotebook, index: 1 },
      3: { alias: 'afterUSN', type: Thrift.Type.I32, index: 2 },
      4: { alias: 'maxEntries', type: Thrift.Type.I32, index: 3 },
      5: { alias: 'fullSyncOnly', type: Thrift.Type.BOOL, index: 4 }
    }),
    result: Thrift.Struct.define('getLinkedNotebookSyncChunkResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.SyncChunk },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.listNotebooks = Thrift.Method.define({
    alias: 'listNotebooks',
    args: Thrift.Struct.define('listNotebooksArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('listNotebooksResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Notebook)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.listPublishedBusinessNotebooks = Thrift.Method.define({
    alias: 'listPublishedBusinessNotebooks',
    args: Thrift.Struct.define('listPublishedBusinessNotebooksArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('listPublishedBusinessNotebooksResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Notebook)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.listAccessibleBusinessNotebooks = Thrift.Method.define({
    alias: 'listAccessibleBusinessNotebooks',
    args: Thrift.Struct.define('listAccessibleBusinessNotebooksArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('listAccessibleBusinessNotebooksResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Notebook)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getNotebook = Thrift.Method.define({
    alias: 'getNotebook',
    args: Thrift.Struct.define('getNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Notebook },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getDefaultNotebook = Thrift.Method.define({
    alias: 'getDefaultNotebook',
    args: Thrift.Struct.define('getDefaultNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getDefaultNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Notebook },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.createNotebook = Thrift.Method.define({
    alias: 'createNotebook',
    args: Thrift.Struct.define('createNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'notebook', type: Thrift.Type.STRUCT, def: Types.Notebook, index: 1 }
    }),
    result: Thrift.Struct.define('createNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Notebook },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.updateNotebook = Thrift.Method.define({
    alias: 'updateNotebook',
    args: Thrift.Struct.define('updateNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'notebook', type: Thrift.Type.STRUCT, def: Types.Notebook, index: 1 }
    }),
    result: Thrift.Struct.define('updateNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.expungeNotebook = Thrift.Method.define({
    alias: 'expungeNotebook',
    args: Thrift.Struct.define('expungeNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('expungeNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.listTags = Thrift.Method.define({
    alias: 'listTags',
    args: Thrift.Struct.define('listTagsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('listTagsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Tag)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.listTagsByNotebook = Thrift.Method.define({
    alias: 'listTagsByNotebook',
    args: Thrift.Struct.define('listTagsByNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'notebookGuid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('listTagsByNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Tag)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getTag = Thrift.Method.define({
    alias: 'getTag',
    args: Thrift.Struct.define('getTagArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getTagResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Tag },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.createTag = Thrift.Method.define({
    alias: 'createTag',
    args: Thrift.Struct.define('createTagArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'tag', type: Thrift.Type.STRUCT, def: Types.Tag, index: 1 }
    }),
    result: Thrift.Struct.define('createTagResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Tag },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.updateTag = Thrift.Method.define({
    alias: 'updateTag',
    args: Thrift.Struct.define('updateTagArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'tag', type: Thrift.Type.STRUCT, def: Types.Tag, index: 1 }
    }),
    result: Thrift.Struct.define('updateTagResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.untagAll = Thrift.Method.define({
    alias: 'untagAll',
    args: Thrift.Struct.define('untagAllArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('untagAllResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.expungeTag = Thrift.Method.define({
    alias: 'expungeTag',
    args: Thrift.Struct.define('expungeTagArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('expungeTagResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.listSearches = Thrift.Method.define({
    alias: 'listSearches',
    args: Thrift.Struct.define('listSearchesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('listSearchesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.SavedSearch)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getSearch = Thrift.Method.define({
    alias: 'getSearch',
    args: Thrift.Struct.define('getSearchArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getSearchResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.SavedSearch },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.createSearch = Thrift.Method.define({
    alias: 'createSearch',
    args: Thrift.Struct.define('createSearchArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'search', type: Thrift.Type.STRUCT, def: Types.SavedSearch, index: 1 }
    }),
    result: Thrift.Struct.define('createSearchResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.SavedSearch },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.updateSearch = Thrift.Method.define({
    alias: 'updateSearch',
    args: Thrift.Struct.define('updateSearchArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'search', type: Thrift.Type.STRUCT, def: Types.SavedSearch, index: 1 }
    }),
    result: Thrift.Struct.define('updateSearchResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.expungeSearch = Thrift.Method.define({
    alias: 'expungeSearch',
    args: Thrift.Struct.define('expungeSearchArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('expungeSearchResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.findNotes = Thrift.Method.define({
    alias: 'findNotes',
    args: Thrift.Struct.define('findNotesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'filter', type: Thrift.Type.STRUCT, def: exports.NoteFilter, index: 1 },
      3: { alias: 'offset', type: Thrift.Type.I32, index: 2 },
      4: { alias: 'maxNotes', type: Thrift.Type.I32, index: 3 }
    }),
    result: Thrift.Struct.define('findNotesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.NoteList },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.findNoteOffset = Thrift.Method.define({
    alias: 'findNoteOffset',
    args: Thrift.Struct.define('findNoteOffsetArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'filter', type: Thrift.Type.STRUCT, def: exports.NoteFilter, index: 1 },
      3: { alias: 'guid', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('findNoteOffsetResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.findNotesMetadata = Thrift.Method.define({
    alias: 'findNotesMetadata',
    args: Thrift.Struct.define('findNotesMetadataArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'filter', type: Thrift.Type.STRUCT, def: exports.NoteFilter, index: 1 },
      3: { alias: 'offset', type: Thrift.Type.I32, index: 2 },
      4: { alias: 'maxNotes', type: Thrift.Type.I32, index: 3 },
      5: { alias: 'resultSpec', type: Thrift.Type.STRUCT, def: exports.NotesMetadataResultSpec, index: 4 }
    }),
    result: Thrift.Struct.define('findNotesMetadataResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.NotesMetadataList },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getNoteSnippets = Thrift.Method.define({
    alias: 'getNoteSnippets',
    args: Thrift.Struct.define('getNoteSnippetsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuids', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING) , index: 1 },
      3: { alias: 'maxSnippetLength', type: Thrift.Type.I32, index: 2 }
    }),
    result: Thrift.Struct.define('getNoteSnippetsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.STRING )  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.findNoteCounts = Thrift.Method.define({
    alias: 'findNoteCounts',
    args: Thrift.Struct.define('findNoteCountsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'filter', type: Thrift.Type.STRUCT, def: exports.NoteFilter, index: 1 },
      3: { alias: 'withTrash', type: Thrift.Type.BOOL, index: 2 }
    }),
    result: Thrift.Struct.define('findNoteCountsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.NoteCollectionCounts },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getNoteWithResultSpec = Thrift.Method.define({
    alias: 'getNoteWithResultSpec',
    args: Thrift.Struct.define('getNoteWithResultSpecArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'resultSpec', type: Thrift.Type.STRUCT, def: exports.NoteResultSpec, index: 2 }
    }),
    result: Thrift.Struct.define('getNoteWithResultSpecResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Note },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getNote = Thrift.Method.define({
    alias: 'getNote',
    args: Thrift.Struct.define('getNoteArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'withContent', type: Thrift.Type.BOOL, index: 2 },
      4: { alias: 'withResourcesData', type: Thrift.Type.BOOL, index: 3 },
      5: { alias: 'withResourcesRecognition', type: Thrift.Type.BOOL, index: 4 },
      6: { alias: 'withResourcesAlternateData', type: Thrift.Type.BOOL, index: 5 }
    }),
    result: Thrift.Struct.define('getNoteResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Note },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getPreferences = Thrift.Method.define({
    alias: 'getPreferences',
    args: Thrift.Struct.define('getPreferencesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'preferenceNames', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING) , index: 1 }
    }),
    result: Thrift.Struct.define('getPreferencesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.Preferences },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.updatePreferences = Thrift.Method.define({
    alias: 'updatePreferences',
    args: Thrift.Struct.define('updatePreferencesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'preferencesToUpdate', type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.LIST, Thrift.List.define(Thrift.Type.STRING) ) , index: 1 }
    }),
    result: Thrift.Struct.define('updatePreferencesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getNoteApplicationData = Thrift.Method.define({
    alias: 'getNoteApplicationData',
    args: Thrift.Struct.define('getNoteApplicationDataArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getNoteApplicationDataResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.LazyMap },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getNoteApplicationDataEntry = Thrift.Method.define({
    alias: 'getNoteApplicationDataEntry',
    args: Thrift.Struct.define('getNoteApplicationDataEntryArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'key', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('getNoteApplicationDataEntryResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRING },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.setNoteApplicationDataEntry = Thrift.Method.define({
    alias: 'setNoteApplicationDataEntry',
    args: Thrift.Struct.define('setNoteApplicationDataEntryArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'key', type: Thrift.Type.STRING, index: 2 },
      4: { alias: 'value', type: Thrift.Type.STRING, index: 3 }
    }),
    result: Thrift.Struct.define('setNoteApplicationDataEntryResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.unsetNoteApplicationDataEntry = Thrift.Method.define({
    alias: 'unsetNoteApplicationDataEntry',
    args: Thrift.Struct.define('unsetNoteApplicationDataEntryArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'key', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('unsetNoteApplicationDataEntryResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getNoteContent = Thrift.Method.define({
    alias: 'getNoteContent',
    args: Thrift.Struct.define('getNoteContentArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getNoteContentResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRING },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getNoteSearchText = Thrift.Method.define({
    alias: 'getNoteSearchText',
    args: Thrift.Struct.define('getNoteSearchTextArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'noteOnly', type: Thrift.Type.BOOL, index: 2 },
      4: { alias: 'tokenizeForIndexing', type: Thrift.Type.BOOL, index: 3 }
    }),
    result: Thrift.Struct.define('getNoteSearchTextResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRING },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getResourceSearchText = Thrift.Method.define({
    alias: 'getResourceSearchText',
    args: Thrift.Struct.define('getResourceSearchTextArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getResourceSearchTextResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRING },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getNoteTagNames = Thrift.Method.define({
    alias: 'getNoteTagNames',
    args: Thrift.Struct.define('getNoteTagNamesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getNoteTagNamesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.createNote = Thrift.Method.define({
    alias: 'createNote',
    args: Thrift.Struct.define('createNoteArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'note', type: Thrift.Type.STRUCT, def: Types.Note, index: 1 }
    }),
    result: Thrift.Struct.define('createNoteResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Note },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.updateNote = Thrift.Method.define({
    alias: 'updateNote',
    args: Thrift.Struct.define('updateNoteArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'note', type: Thrift.Type.STRUCT, def: Types.Note, index: 1 }
    }),
    result: Thrift.Struct.define('updateNoteResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Note },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.deleteNote = Thrift.Method.define({
    alias: 'deleteNote',
    args: Thrift.Struct.define('deleteNoteArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('deleteNoteResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.expungeNote = Thrift.Method.define({
    alias: 'expungeNote',
    args: Thrift.Struct.define('expungeNoteArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('expungeNoteResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.expungeNotes = Thrift.Method.define({
    alias: 'expungeNotes',
    args: Thrift.Struct.define('expungeNotesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuids', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING) , index: 1 }
    }),
    result: Thrift.Struct.define('expungeNotesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.expungeInactiveNotes = Thrift.Method.define({
    alias: 'expungeInactiveNotes',
    args: Thrift.Struct.define('expungeInactiveNotesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('expungeInactiveNotesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.copyNote = Thrift.Method.define({
    alias: 'copyNote',
    args: Thrift.Struct.define('copyNoteArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'toNotebookGuid', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('copyNoteResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Note },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.listNoteVersions = Thrift.Method.define({
    alias: 'listNoteVersions',
    args: Thrift.Struct.define('listNoteVersionsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('listNoteVersionsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.NoteVersionId)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getNoteVersion = Thrift.Method.define({
    alias: 'getNoteVersion',
    args: Thrift.Struct.define('getNoteVersionArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'updateSequenceNum', type: Thrift.Type.I32, index: 2 },
      4: { alias: 'withResourcesData', type: Thrift.Type.BOOL, index: 3 },
      5: { alias: 'withResourcesRecognition', type: Thrift.Type.BOOL, index: 4 },
      6: { alias: 'withResourcesAlternateData', type: Thrift.Type.BOOL, index: 5 }
    }),
    result: Thrift.Struct.define('getNoteVersionResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Note },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getResource = Thrift.Method.define({
    alias: 'getResource',
    args: Thrift.Struct.define('getResourceArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'withData', type: Thrift.Type.BOOL, index: 2 },
      4: { alias: 'withRecognition', type: Thrift.Type.BOOL, index: 3 },
      5: { alias: 'withAttributes', type: Thrift.Type.BOOL, index: 4 },
      6: { alias: 'withAlternateData', type: Thrift.Type.BOOL, index: 5 }
    }),
    result: Thrift.Struct.define('getResourceResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Resource },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getResourceApplicationData = Thrift.Method.define({
    alias: 'getResourceApplicationData',
    args: Thrift.Struct.define('getResourceApplicationDataArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getResourceApplicationDataResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.LazyMap },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getResourceApplicationDataEntry = Thrift.Method.define({
    alias: 'getResourceApplicationDataEntry',
    args: Thrift.Struct.define('getResourceApplicationDataEntryArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'key', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('getResourceApplicationDataEntryResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRING },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.setResourceApplicationDataEntry = Thrift.Method.define({
    alias: 'setResourceApplicationDataEntry',
    args: Thrift.Struct.define('setResourceApplicationDataEntryArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'key', type: Thrift.Type.STRING, index: 2 },
      4: { alias: 'value', type: Thrift.Type.STRING, index: 3 }
    }),
    result: Thrift.Struct.define('setResourceApplicationDataEntryResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.unsetResourceApplicationDataEntry = Thrift.Method.define({
    alias: 'unsetResourceApplicationDataEntry',
    args: Thrift.Struct.define('unsetResourceApplicationDataEntryArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'key', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('unsetResourceApplicationDataEntryResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.updateResource = Thrift.Method.define({
    alias: 'updateResource',
    args: Thrift.Struct.define('updateResourceArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'resource', type: Thrift.Type.STRUCT, def: Types.Resource, index: 1 }
    }),
    result: Thrift.Struct.define('updateResourceResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getResourceData = Thrift.Method.define({
    alias: 'getResourceData',
    args: Thrift.Struct.define('getResourceDataArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getResourceDataResult', {
      0: { alias: 'returnValue',type: Thrift.Type.BINARY },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getResourceByHash = Thrift.Method.define({
    alias: 'getResourceByHash',
    args: Thrift.Struct.define('getResourceByHashArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'contentHash', type: Thrift.Type.BINARY, index: 2 },
      4: { alias: 'withData', type: Thrift.Type.BOOL, index: 3 },
      5: { alias: 'withRecognition', type: Thrift.Type.BOOL, index: 4 },
      6: { alias: 'withAlternateData', type: Thrift.Type.BOOL, index: 5 }
    }),
    result: Thrift.Struct.define('getResourceByHashResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Resource },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getResourceRecognition = Thrift.Method.define({
    alias: 'getResourceRecognition',
    args: Thrift.Struct.define('getResourceRecognitionArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getResourceRecognitionResult', {
      0: { alias: 'returnValue',type: Thrift.Type.BINARY },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getResourceAlternateData = Thrift.Method.define({
    alias: 'getResourceAlternateData',
    args: Thrift.Struct.define('getResourceAlternateDataArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getResourceAlternateDataResult', {
      0: { alias: 'returnValue',type: Thrift.Type.BINARY },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getResourceAttributes = Thrift.Method.define({
    alias: 'getResourceAttributes',
    args: Thrift.Struct.define('getResourceAttributesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getResourceAttributesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.ResourceAttributes },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getAds = Thrift.Method.define({
    alias: 'getAds',
    args: Thrift.Struct.define('getAdsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'adParameters', type: Thrift.Type.STRUCT, def: exports.AdParameters, index: 1 }
    }),
    result: Thrift.Struct.define('getAdsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Ad)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getRandomAd = Thrift.Method.define({
    alias: 'getRandomAd',
    args: Thrift.Struct.define('getRandomAdArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'adParameters', type: Thrift.Type.STRUCT, def: exports.AdParameters, index: 1 }
    }),
    result: Thrift.Struct.define('getRandomAdResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Ad },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getPublicNotebook = Thrift.Method.define({
    alias: 'getPublicNotebook',
    args: Thrift.Struct.define('getPublicNotebookArgs', {
      1: { alias: 'userId', type: Thrift.Type.I32, index: 0 },
      2: { alias: 'publicUri', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getPublicNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Notebook },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.createSharedNotebook = Thrift.Method.define({
    alias: 'createSharedNotebook',
    args: Thrift.Struct.define('createSharedNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'sharedNotebook', type: Thrift.Type.STRUCT, def: Types.SharedNotebook, index: 1 }
    }),
    result: Thrift.Struct.define('createSharedNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.SharedNotebook },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.shareNotebook = Thrift.Method.define({
    alias: 'shareNotebook',
    args: Thrift.Struct.define('shareNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'sharedNotebook', type: Thrift.Type.STRUCT, def: Types.SharedNotebook, index: 1 },
      3: { alias: 'message', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('shareNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.SharedNotebook },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.createOrUpdateNotebookShares = Thrift.Method.define({
    alias: 'createOrUpdateNotebookShares',
    args: Thrift.Struct.define('createOrUpdateNotebookSharesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'shareTemplate', type: Thrift.Type.STRUCT, def: exports.NotebookShareTemplate, index: 1 }
    }),
    result: Thrift.Struct.define('createOrUpdateNotebookSharesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.CreateOrUpdateNotebookSharesResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      4: { alias: 'invalidContactsException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMInvalidContactsException }
    })
  });

  NoteStore.updateSharedNotebook = Thrift.Method.define({
    alias: 'updateSharedNotebook',
    args: Thrift.Struct.define('updateSharedNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'sharedNotebook', type: Thrift.Type.STRUCT, def: Types.SharedNotebook, index: 1 }
    }),
    result: Thrift.Struct.define('updateSharedNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.setSharedNotebookRecipientSettings = Thrift.Method.define({
    alias: 'setSharedNotebookRecipientSettings',
    args: Thrift.Struct.define('setSharedNotebookRecipientSettingsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'sharedNotebookId', type: Thrift.Type.I64, index: 1 },
      3: { alias: 'recipientSettings', type: Thrift.Type.STRUCT, def: Types.SharedNotebookRecipientSettings, index: 2 }
    }),
    result: Thrift.Struct.define('setSharedNotebookRecipientSettingsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.setNotebookRecipientSettings = Thrift.Method.define({
    alias: 'setNotebookRecipientSettings',
    args: Thrift.Struct.define('setNotebookRecipientSettingsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'notebookGuid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'recipientSettings', type: Thrift.Type.STRUCT, def: Types.NotebookRecipientSettings, index: 2 }
    }),
    result: Thrift.Struct.define('setNotebookRecipientSettingsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.Notebook },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.sendMessageToSharedNotebookMembers = Thrift.Method.define({
    alias: 'sendMessageToSharedNotebookMembers',
    args: Thrift.Struct.define('sendMessageToSharedNotebookMembersArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'notebookGuid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'messageText', type: Thrift.Type.STRING, index: 2 },
      4: { alias: 'recipients', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING) , index: 3 }
    }),
    result: Thrift.Struct.define('sendMessageToSharedNotebookMembersResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.listSharedNotebooks = Thrift.Method.define({
    alias: 'listSharedNotebooks',
    args: Thrift.Struct.define('listSharedNotebooksArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('listSharedNotebooksResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.SharedNotebook)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.expungeSharedNotebooks = Thrift.Method.define({
    alias: 'expungeSharedNotebooks',
    args: Thrift.Struct.define('expungeSharedNotebooksArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'sharedNotebookIds', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.I64) , index: 1 }
    }),
    result: Thrift.Struct.define('expungeSharedNotebooksResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.createLinkedNotebook = Thrift.Method.define({
    alias: 'createLinkedNotebook',
    args: Thrift.Struct.define('createLinkedNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'linkedNotebook', type: Thrift.Type.STRUCT, def: Types.LinkedNotebook, index: 1 }
    }),
    result: Thrift.Struct.define('createLinkedNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.LinkedNotebook },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.updateLinkedNotebook = Thrift.Method.define({
    alias: 'updateLinkedNotebook',
    args: Thrift.Struct.define('updateLinkedNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'linkedNotebook', type: Thrift.Type.STRUCT, def: Types.LinkedNotebook, index: 1 }
    }),
    result: Thrift.Struct.define('updateLinkedNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.listLinkedNotebooks = Thrift.Method.define({
    alias: 'listLinkedNotebooks',
    args: Thrift.Struct.define('listLinkedNotebooksArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('listLinkedNotebooksResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.LinkedNotebook)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.expungeLinkedNotebook = Thrift.Method.define({
    alias: 'expungeLinkedNotebook',
    args: Thrift.Struct.define('expungeLinkedNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('expungeLinkedNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.authenticateToSharedNotebook = Thrift.Method.define({
    alias: 'authenticateToSharedNotebook',
    args: Thrift.Struct.define('authenticateToSharedNotebookArgs', {
      1: { alias: 'shareKeyOrGlobalId', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('authenticateToSharedNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: UserStore.AuthenticationResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getSharedNotebookByAuth = Thrift.Method.define({
    alias: 'getSharedNotebookByAuth',
    args: Thrift.Struct.define('getSharedNotebookByAuthArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getSharedNotebookByAuthResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.SharedNotebook },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.emailNote = Thrift.Method.define({
    alias: 'emailNote',
    args: Thrift.Struct.define('emailNoteArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'parameters', type: Thrift.Type.STRUCT, def: exports.NoteEmailParameters, index: 1 }
    }),
    result: Thrift.Struct.define('emailNoteResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.shareNote = Thrift.Method.define({
    alias: 'shareNote',
    args: Thrift.Struct.define('shareNoteArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('shareNoteResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRING },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.stopSharingNote = Thrift.Method.define({
    alias: 'stopSharingNote',
    args: Thrift.Struct.define('stopSharingNoteArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('stopSharingNoteResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.stopSharingNoteWithRecipients = Thrift.Method.define({
    alias: 'stopSharingNoteWithRecipients',
    args: Thrift.Struct.define('stopSharingNoteWithRecipientsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'guid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('stopSharingNoteWithRecipientsResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.authenticateToSharedNote = Thrift.Method.define({
    alias: 'authenticateToSharedNote',
    args: Thrift.Struct.define('authenticateToSharedNoteArgs', {
      1: { alias: 'guid', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteKey', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('authenticateToSharedNoteResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: UserStore.AuthenticationResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.createOrUpdateSharedNotes = Thrift.Method.define({
    alias: 'createOrUpdateSharedNotes',
    args: Thrift.Struct.define('createOrUpdateSharedNotesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'shareTemplate', type: Thrift.Type.STRUCT, def: exports.SharedNoteTemplate, index: 1 }
    }),
    result: Thrift.Struct.define('createOrUpdateSharedNotesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.SharedNote)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      4: { alias: 'invalidContactsException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMInvalidContactsException }
    })
  });

  NoteStore.findRelated = Thrift.Method.define({
    alias: 'findRelated',
    args: Thrift.Struct.define('findRelatedArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'query', type: Thrift.Type.STRUCT, def: exports.RelatedQuery, index: 1 },
      3: { alias: 'resultSpec', type: Thrift.Type.STRUCT, def: exports.RelatedResultSpec, index: 2 }
    }),
    result: Thrift.Struct.define('findRelatedResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.RelatedResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.findSearchSuggestions = Thrift.Method.define({
    alias: 'findSearchSuggestions',
    args: Thrift.Struct.define('findSearchSuggestionsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'query', type: Thrift.Type.STRUCT, def: exports.SearchSuggestionQuery, index: 1 },
      3: { alias: 'resultSpec', type: Thrift.Type.STRUCT, def: exports.SearchSuggestionResultSpec, index: 2 }
    }),
    result: Thrift.Struct.define('findSearchSuggestionsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.SearchSuggestionResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.updateUserSetting = Thrift.Method.define({
    alias: 'updateUserSetting',
    args: Thrift.Struct.define('updateUserSettingArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'setting', type: Thrift.Type.I32, index: 1 },
      3: { alias: 'value', type: Thrift.Type.STRING, index: 2 }
    }),
    result: Thrift.Struct.define('updateUserSettingResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.findTimeZones = Thrift.Method.define({
    alias: 'findTimeZones',
    args: Thrift.Struct.define('findTimeZonesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'timeZoneSpec', type: Thrift.Type.STRUCT, def: exports.TimeZoneSpec, index: 1 },
      3: { alias: 'maxTimeZones', type: Thrift.Type.I32, index: 2 }
    }),
    result: Thrift.Struct.define('findTimeZonesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.TimeZone)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.findContacts = Thrift.Method.define({
    alias: 'findContacts',
    args: Thrift.Struct.define('findContactsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'query', type: Thrift.Type.STRUCT, def: exports.ContactsQuery, index: 1 }
    }),
    result: Thrift.Struct.define('findContactsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.Contact)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.findInBusiness = Thrift.Method.define({
    alias: 'findInBusiness',
    args: Thrift.Struct.define('findInBusinessArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'query', type: Thrift.Type.STRUCT, def: exports.BusinessQuery, index: 1 }
    }),
    result: Thrift.Struct.define('findInBusinessResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.BusinessQueryResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.shareNoteWithBusiness = Thrift.Method.define({
    alias: 'shareNoteWithBusiness',
    args: Thrift.Struct.define('shareNoteWithBusinessArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('shareNoteWithBusinessResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.stopSharingNoteWithBusiness = Thrift.Method.define({
    alias: 'stopSharingNoteWithBusiness',
    args: Thrift.Struct.define('stopSharingNoteWithBusinessArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('stopSharingNoteWithBusinessResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I32 },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.requestAccessToNotebook = Thrift.Method.define({
    alias: 'requestAccessToNotebook',
    args: Thrift.Struct.define('requestAccessToNotebookArgs', {
      1: { alias: 'authToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'notebookGuid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'privilegeLevel', type: Thrift.Type.I32, index: 2 }
    }),
    result: Thrift.Struct.define('requestAccessToNotebookResult', {
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getNoteLockStatus = Thrift.Method.define({
    alias: 'getNoteLockStatus',
    args: Thrift.Struct.define('getNoteLockStatusArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getNoteLockStatusResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.NoteLockStatus },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.acquireNoteLock = Thrift.Method.define({
    alias: 'acquireNoteLock',
    args: Thrift.Struct.define('acquireNoteLockArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('acquireNoteLockResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.NoteLockStatus },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.releaseNoteLock = Thrift.Method.define({
    alias: 'releaseNoteLock',
    args: Thrift.Struct.define('releaseNoteLockArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('releaseNoteLockResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.NoteLockStatus },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getViewersForNotes = Thrift.Method.define({
    alias: 'getViewersForNotes',
    args: Thrift.Struct.define('getViewersForNotesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuids', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING) , index: 1 }
    }),
    result: Thrift.Struct.define('getViewersForNotesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.STRUCT, exports.NoteLockStatus)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.updateNoteIfUsnMatches = Thrift.Method.define({
    alias: 'updateNoteIfUsnMatches',
    args: Thrift.Struct.define('updateNoteIfUsnMatchesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'note', type: Thrift.Type.STRUCT, def: Types.Note, index: 1 }
    }),
    result: Thrift.Struct.define('updateNoteIfUsnMatchesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.UpdateNoteIfUsnMatchesResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.manageNotebookShares = Thrift.Method.define({
    alias: 'manageNotebookShares',
    args: Thrift.Struct.define('manageNotebookSharesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'parameters', type: Thrift.Type.STRUCT, def: exports.ManageNotebookSharesParameters, index: 1 }
    }),
    result: Thrift.Struct.define('manageNotebookSharesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.ManageNotebookSharesResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getNotebookShares = Thrift.Method.define({
    alias: 'getNotebookShares',
    args: Thrift.Struct.define('getNotebookSharesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'notebookGuid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getNotebookSharesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.ShareRelationships },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.getNoteShares = Thrift.Method.define({
    alias: 'getNoteShares',
    args: Thrift.Struct.define('getNoteSharesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'noteGuid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getNoteSharesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.NoteShareRelationships },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.manageNoteShares = Thrift.Method.define({
    alias: 'manageNoteShares',
    args: Thrift.Struct.define('manageNoteSharesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'parameters', type: Thrift.Type.STRUCT, def: exports.ManageNoteSharesParameters, index: 1 }
    }),
    result: Thrift.Struct.define('manageNoteSharesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.ManageNoteSharesResult },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.joinPublishedBusinessNotebook = Thrift.Method.define({
    alias: 'joinPublishedBusinessNotebook',
    args: Thrift.Struct.define('joinPublishedBusinessNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'notebookGuid', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('joinPublishedBusinessNotebookResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: Types.SharedNotebook },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  NoteStore.unpublishNotebook = Thrift.Method.define({
    alias: 'unpublishNotebook',
    args: Thrift.Struct.define('unpublishNotebookArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'notebookGuid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'convertGroupSharesToIndividual', type: Thrift.Type.BOOL, index: 2 }
    }),
    result: Thrift.Struct.define('unpublishNotebookResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  NoteStore.getNotebookSharesEmailAddresses = Thrift.Method.define({
    alias: 'getNotebookSharesEmailAddresses',
    args: Thrift.Struct.define('getNotebookSharesEmailAddressesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'notebookGuid', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'identities', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, Types.UserIdentity) , index: 2 },
      4: { alias: 'skipUnknownUserIdentities', type: Thrift.Type.BOOL, index: 3 }
    }),
    result: Thrift.Struct.define('getNotebookSharesEmailAddressesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.SET, def: Thrift.Set.define(Thrift.Type.STRING) },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  // Define NoteStore Client

  function NoteStoreClient(output) {
    this.output = output;
    this.seqid = 0;
  }

  NoteStoreClient.prototype.getSyncState = function(authenticationToken, callback) {
    var mdef = NoteStore.getSyncState;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getSyncStateWithMetrics = function(authenticationToken, clientMetrics, callback) {
    var mdef = NoteStore.getSyncStateWithMetrics;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.clientMetrics = clientMetrics;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getSyncChunk = function(authenticationToken, afterUSN, maxEntries, fullSyncOnly, callback) {
    var mdef = NoteStore.getSyncChunk;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.afterUSN = afterUSN;
    args.maxEntries = maxEntries;
    args.fullSyncOnly = fullSyncOnly;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getFilteredSyncChunk = function(authenticationToken, afterUSN, maxEntries, filter, callback) {
    var mdef = NoteStore.getFilteredSyncChunk;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.afterUSN = afterUSN;
    args.maxEntries = maxEntries;
    args.filter = filter;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getLinkedNotebookSyncState = function(authenticationToken, linkedNotebook, callback) {
    var mdef = NoteStore.getLinkedNotebookSyncState;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.linkedNotebook = linkedNotebook;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getLinkedNotebookSyncChunk = function(authenticationToken, linkedNotebook, afterUSN, maxEntries, fullSyncOnly, callback) {
    var mdef = NoteStore.getLinkedNotebookSyncChunk;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.linkedNotebook = linkedNotebook;
    args.afterUSN = afterUSN;
    args.maxEntries = maxEntries;
    args.fullSyncOnly = fullSyncOnly;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.listNotebooks = function(authenticationToken, callback) {
    var mdef = NoteStore.listNotebooks;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.listPublishedBusinessNotebooks = function(authenticationToken, callback) {
    var mdef = NoteStore.listPublishedBusinessNotebooks;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.listAccessibleBusinessNotebooks = function(authenticationToken, callback) {
    var mdef = NoteStore.listAccessibleBusinessNotebooks;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNotebook = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getDefaultNotebook = function(authenticationToken, callback) {
    var mdef = NoteStore.getDefaultNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.createNotebook = function(authenticationToken, notebook, callback) {
    var mdef = NoteStore.createNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.notebook = notebook;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.updateNotebook = function(authenticationToken, notebook, callback) {
    var mdef = NoteStore.updateNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.notebook = notebook;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.expungeNotebook = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.expungeNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.listTags = function(authenticationToken, callback) {
    var mdef = NoteStore.listTags;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.listTagsByNotebook = function(authenticationToken, notebookGuid, callback) {
    var mdef = NoteStore.listTagsByNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.notebookGuid = notebookGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getTag = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getTag;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.createTag = function(authenticationToken, tag, callback) {
    var mdef = NoteStore.createTag;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.tag = tag;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.updateTag = function(authenticationToken, tag, callback) {
    var mdef = NoteStore.updateTag;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.tag = tag;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.untagAll = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.untagAll;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.expungeTag = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.expungeTag;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.listSearches = function(authenticationToken, callback) {
    var mdef = NoteStore.listSearches;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getSearch = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getSearch;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.createSearch = function(authenticationToken, search, callback) {
    var mdef = NoteStore.createSearch;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.search = search;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.updateSearch = function(authenticationToken, search, callback) {
    var mdef = NoteStore.updateSearch;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.search = search;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.expungeSearch = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.expungeSearch;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.findNotes = function(authenticationToken, filter, offset, maxNotes, callback) {
    var mdef = NoteStore.findNotes;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.filter = filter;
    args.offset = offset;
    args.maxNotes = maxNotes;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.findNoteOffset = function(authenticationToken, filter, guid, callback) {
    var mdef = NoteStore.findNoteOffset;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.filter = filter;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.findNotesMetadata = function(authenticationToken, filter, offset, maxNotes, resultSpec, callback) {
    var mdef = NoteStore.findNotesMetadata;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.filter = filter;
    args.offset = offset;
    args.maxNotes = maxNotes;
    args.resultSpec = resultSpec;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNoteSnippets = function(authenticationToken, noteGuids, maxSnippetLength, callback) {
    var mdef = NoteStore.getNoteSnippets;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuids = noteGuids;
    args.maxSnippetLength = maxSnippetLength;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.findNoteCounts = function(authenticationToken, filter, withTrash, callback) {
    var mdef = NoteStore.findNoteCounts;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.filter = filter;
    args.withTrash = withTrash;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNoteWithResultSpec = function(authenticationToken, guid, resultSpec, callback) {
    var mdef = NoteStore.getNoteWithResultSpec;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    args.resultSpec = resultSpec;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNote = function(authenticationToken, guid, withContent, withResourcesData, withResourcesRecognition, withResourcesAlternateData, callback) {
    var mdef = NoteStore.getNote;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    args.withContent = withContent;
    args.withResourcesData = withResourcesData;
    args.withResourcesRecognition = withResourcesRecognition;
    args.withResourcesAlternateData = withResourcesAlternateData;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getPreferences = function(authenticationToken, preferenceNames, callback) {
    var mdef = NoteStore.getPreferences;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.preferenceNames = preferenceNames;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.updatePreferences = function(authenticationToken, preferencesToUpdate, callback) {
    var mdef = NoteStore.updatePreferences;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.preferencesToUpdate = preferencesToUpdate;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNoteApplicationData = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getNoteApplicationData;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNoteApplicationDataEntry = function(authenticationToken, guid, key, callback) {
    var mdef = NoteStore.getNoteApplicationDataEntry;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    args.key = key;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.setNoteApplicationDataEntry = function(authenticationToken, guid, key, value, callback) {
    var mdef = NoteStore.setNoteApplicationDataEntry;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    args.key = key;
    args.value = value;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.unsetNoteApplicationDataEntry = function(authenticationToken, guid, key, callback) {
    var mdef = NoteStore.unsetNoteApplicationDataEntry;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    args.key = key;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNoteContent = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getNoteContent;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNoteSearchText = function(authenticationToken, guid, noteOnly, tokenizeForIndexing, callback) {
    var mdef = NoteStore.getNoteSearchText;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    args.noteOnly = noteOnly;
    args.tokenizeForIndexing = tokenizeForIndexing;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getResourceSearchText = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getResourceSearchText;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNoteTagNames = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getNoteTagNames;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.createNote = function(authenticationToken, note, callback) {
    var mdef = NoteStore.createNote;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.note = note;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.updateNote = function(authenticationToken, note, callback) {
    var mdef = NoteStore.updateNote;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.note = note;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.deleteNote = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.deleteNote;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.expungeNote = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.expungeNote;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.expungeNotes = function(authenticationToken, noteGuids, callback) {
    var mdef = NoteStore.expungeNotes;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuids = noteGuids;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.expungeInactiveNotes = function(authenticationToken, callback) {
    var mdef = NoteStore.expungeInactiveNotes;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.copyNote = function(authenticationToken, noteGuid, toNotebookGuid, callback) {
    var mdef = NoteStore.copyNote;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuid = noteGuid;
    args.toNotebookGuid = toNotebookGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.listNoteVersions = function(authenticationToken, noteGuid, callback) {
    var mdef = NoteStore.listNoteVersions;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuid = noteGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNoteVersion = function(authenticationToken, noteGuid, updateSequenceNum, withResourcesData, withResourcesRecognition, withResourcesAlternateData, callback) {
    var mdef = NoteStore.getNoteVersion;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuid = noteGuid;
    args.updateSequenceNum = updateSequenceNum;
    args.withResourcesData = withResourcesData;
    args.withResourcesRecognition = withResourcesRecognition;
    args.withResourcesAlternateData = withResourcesAlternateData;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getResource = function(authenticationToken, guid, withData, withRecognition, withAttributes, withAlternateData, callback) {
    var mdef = NoteStore.getResource;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    args.withData = withData;
    args.withRecognition = withRecognition;
    args.withAttributes = withAttributes;
    args.withAlternateData = withAlternateData;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getResourceApplicationData = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getResourceApplicationData;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getResourceApplicationDataEntry = function(authenticationToken, guid, key, callback) {
    var mdef = NoteStore.getResourceApplicationDataEntry;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    args.key = key;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.setResourceApplicationDataEntry = function(authenticationToken, guid, key, value, callback) {
    var mdef = NoteStore.setResourceApplicationDataEntry;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    args.key = key;
    args.value = value;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.unsetResourceApplicationDataEntry = function(authenticationToken, guid, key, callback) {
    var mdef = NoteStore.unsetResourceApplicationDataEntry;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    args.key = key;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.updateResource = function(authenticationToken, resource, callback) {
    var mdef = NoteStore.updateResource;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.resource = resource;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getResourceData = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getResourceData;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getResourceByHash = function(authenticationToken, noteGuid, contentHash, withData, withRecognition, withAlternateData, callback) {
    var mdef = NoteStore.getResourceByHash;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuid = noteGuid;
    args.contentHash = contentHash;
    args.withData = withData;
    args.withRecognition = withRecognition;
    args.withAlternateData = withAlternateData;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getResourceRecognition = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getResourceRecognition;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getResourceAlternateData = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getResourceAlternateData;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getResourceAttributes = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.getResourceAttributes;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getAds = function(authenticationToken, adParameters, callback) {
    var mdef = NoteStore.getAds;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.adParameters = adParameters;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getRandomAd = function(authenticationToken, adParameters, callback) {
    var mdef = NoteStore.getRandomAd;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.adParameters = adParameters;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getPublicNotebook = function(userId, publicUri, callback) {
    var mdef = NoteStore.getPublicNotebook;
    var args = new mdef.args();
    args.userId = userId;
    args.publicUri = publicUri;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.createSharedNotebook = function(authenticationToken, sharedNotebook, callback) {
    var mdef = NoteStore.createSharedNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.sharedNotebook = sharedNotebook;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.shareNotebook = function(authenticationToken, sharedNotebook, message, callback) {
    var mdef = NoteStore.shareNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.sharedNotebook = sharedNotebook;
    args.message = message;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.createOrUpdateNotebookShares = function(authenticationToken, shareTemplate, callback) {
    var mdef = NoteStore.createOrUpdateNotebookShares;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.shareTemplate = shareTemplate;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.updateSharedNotebook = function(authenticationToken, sharedNotebook, callback) {
    var mdef = NoteStore.updateSharedNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.sharedNotebook = sharedNotebook;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.setSharedNotebookRecipientSettings = function(authenticationToken, sharedNotebookId, recipientSettings, callback) {
    var mdef = NoteStore.setSharedNotebookRecipientSettings;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.sharedNotebookId = sharedNotebookId;
    args.recipientSettings = recipientSettings;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.setNotebookRecipientSettings = function(authenticationToken, notebookGuid, recipientSettings, callback) {
    var mdef = NoteStore.setNotebookRecipientSettings;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.notebookGuid = notebookGuid;
    args.recipientSettings = recipientSettings;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.sendMessageToSharedNotebookMembers = function(authenticationToken, notebookGuid, messageText, recipients, callback) {
    var mdef = NoteStore.sendMessageToSharedNotebookMembers;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.notebookGuid = notebookGuid;
    args.messageText = messageText;
    args.recipients = recipients;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.listSharedNotebooks = function(authenticationToken, callback) {
    var mdef = NoteStore.listSharedNotebooks;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.expungeSharedNotebooks = function(authenticationToken, sharedNotebookIds, callback) {
    var mdef = NoteStore.expungeSharedNotebooks;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.sharedNotebookIds = sharedNotebookIds;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.createLinkedNotebook = function(authenticationToken, linkedNotebook, callback) {
    var mdef = NoteStore.createLinkedNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.linkedNotebook = linkedNotebook;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.updateLinkedNotebook = function(authenticationToken, linkedNotebook, callback) {
    var mdef = NoteStore.updateLinkedNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.linkedNotebook = linkedNotebook;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.listLinkedNotebooks = function(authenticationToken, callback) {
    var mdef = NoteStore.listLinkedNotebooks;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.expungeLinkedNotebook = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.expungeLinkedNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.authenticateToSharedNotebook = function(shareKeyOrGlobalId, authenticationToken, callback) {
    var mdef = NoteStore.authenticateToSharedNotebook;
    var args = new mdef.args();
    args.shareKeyOrGlobalId = shareKeyOrGlobalId;
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getSharedNotebookByAuth = function(authenticationToken, callback) {
    var mdef = NoteStore.getSharedNotebookByAuth;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.emailNote = function(authenticationToken, parameters, callback) {
    var mdef = NoteStore.emailNote;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.parameters = parameters;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.shareNote = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.shareNote;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.stopSharingNote = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.stopSharingNote;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.stopSharingNoteWithRecipients = function(authenticationToken, guid, callback) {
    var mdef = NoteStore.stopSharingNoteWithRecipients;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.guid = guid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.authenticateToSharedNote = function(guid, noteKey, authenticationToken, callback) {
    var mdef = NoteStore.authenticateToSharedNote;
    var args = new mdef.args();
    args.guid = guid;
    args.noteKey = noteKey;
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.createOrUpdateSharedNotes = function(authenticationToken, shareTemplate, callback) {
    var mdef = NoteStore.createOrUpdateSharedNotes;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.shareTemplate = shareTemplate;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.findRelated = function(authenticationToken, query, resultSpec, callback) {
    var mdef = NoteStore.findRelated;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.query = query;
    args.resultSpec = resultSpec;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.findSearchSuggestions = function(authenticationToken, query, resultSpec, callback) {
    var mdef = NoteStore.findSearchSuggestions;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.query = query;
    args.resultSpec = resultSpec;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.updateUserSetting = function(authenticationToken, setting, value, callback) {
    var mdef = NoteStore.updateUserSetting;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.setting = setting;
    args.value = value;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.findTimeZones = function(authenticationToken, timeZoneSpec, maxTimeZones, callback) {
    var mdef = NoteStore.findTimeZones;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.timeZoneSpec = timeZoneSpec;
    args.maxTimeZones = maxTimeZones;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.findContacts = function(authenticationToken, query, callback) {
    var mdef = NoteStore.findContacts;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.query = query;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.findInBusiness = function(authenticationToken, query, callback) {
    var mdef = NoteStore.findInBusiness;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.query = query;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.shareNoteWithBusiness = function(authenticationToken, noteGuid, callback) {
    var mdef = NoteStore.shareNoteWithBusiness;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuid = noteGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.stopSharingNoteWithBusiness = function(authenticationToken, noteGuid, callback) {
    var mdef = NoteStore.stopSharingNoteWithBusiness;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuid = noteGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.requestAccessToNotebook = function(authToken, notebookGuid, privilegeLevel, callback) {
    var mdef = NoteStore.requestAccessToNotebook;
    var args = new mdef.args();
    args.authToken = authToken;
    args.notebookGuid = notebookGuid;
    args.privilegeLevel = privilegeLevel;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNoteLockStatus = function(authenticationToken, noteGuid, callback) {
    var mdef = NoteStore.getNoteLockStatus;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuid = noteGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.acquireNoteLock = function(authenticationToken, noteGuid, callback) {
    var mdef = NoteStore.acquireNoteLock;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuid = noteGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.releaseNoteLock = function(authenticationToken, noteGuid, callback) {
    var mdef = NoteStore.releaseNoteLock;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuid = noteGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getViewersForNotes = function(authenticationToken, noteGuids, callback) {
    var mdef = NoteStore.getViewersForNotes;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuids = noteGuids;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.updateNoteIfUsnMatches = function(authenticationToken, note, callback) {
    var mdef = NoteStore.updateNoteIfUsnMatches;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.note = note;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.manageNotebookShares = function(authenticationToken, parameters, callback) {
    var mdef = NoteStore.manageNotebookShares;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.parameters = parameters;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNotebookShares = function(authenticationToken, notebookGuid, callback) {
    var mdef = NoteStore.getNotebookShares;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.notebookGuid = notebookGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNoteShares = function(authenticationToken, noteGuid, callback) {
    var mdef = NoteStore.getNoteShares;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.noteGuid = noteGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.manageNoteShares = function(authenticationToken, parameters, callback) {
    var mdef = NoteStore.manageNoteShares;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.parameters = parameters;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.joinPublishedBusinessNotebook = function(authenticationToken, notebookGuid, callback) {
    var mdef = NoteStore.joinPublishedBusinessNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.notebookGuid = notebookGuid;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.unpublishNotebook = function(authenticationToken, notebookGuid, convertGroupSharesToIndividual, callback) {
    var mdef = NoteStore.unpublishNotebook;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.notebookGuid = notebookGuid;
    args.convertGroupSharesToIndividual = convertGroupSharesToIndividual;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  NoteStoreClient.prototype.getNotebookSharesEmailAddresses = function(authenticationToken, notebookGuid, identities, skipUnknownUserIdentities, callback) {
    var mdef = NoteStore.getNotebookSharesEmailAddresses;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.notebookGuid = notebookGuid;
    args.identities = identities;
    args.skipUnknownUserIdentities = skipUnknownUserIdentities;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  exports.NoteStore.Client = NoteStoreClient;

  // Define NoteStore Server

  function NoteStoreServer(service, stransport, Protocol) {
    var methodName;
      this.service = service;
      this.stransport = stransport;
      this.processor = new Thrift.Processor();
      for (methodName in NoteStore) {
        if (service[methodName]) {
          this.processor.addMethod(NoteStore[methodName], service[methodName].bind(service));
        }
      }
      this.stransport.process = function (input, output, noop) {
      var inprot = new Protocol(input);
      var outprot = new Protocol(output);
      this.processor.process(inprot, outprot, noop);
    }.bind(this);
  }

  NoteStoreServer.prototype.start = function () {
    this.stransport.listen();
  };
  NoteStoreServer.prototype.stop = function () {
    this.stransport.close();
  };

  exports.NoteStore.Server = NoteStoreServer;

  return exports;

});
//
// Autogenerated by Thrift Compiler (0.5.0-en-exported)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//


define ('Utility',['require','thrift','./Errors','./Types','./MessageStore','./NoteStore'],function (require) {

  // Define types and services

  var Thrift = require('thrift');
  var exports = exports || {};

  var Errors = require('./Errors');
  var Types = require('./Types');
  var MessageStore = require('./MessageStore');
  var NoteStore = require('./NoteStore');


  exports.MarketingEmailType = {
    'DESKTOP_UPSELL' : 1,
    'CLIPPER_UPSELL' : 2,
    'MOBILE_UPSELL' : 3
  };

  exports.RelatedContentSourceType = {
    'NEWS' : 1,
    'PROFILE' : 2,
    'REFERENCE' : 3
  };

  exports.OAUTH_CREDENTIAL_SERVICE_GOOGLE_CONNECT = 1;

  exports.OAUTH_CREDENTIAL_SERVICE_GOOGLE_GLASS = 2;

  exports.OAUTH_CREDENTIAL_SERVICE_FACEBOOK = 3;

  exports.OAUTH_CREDENTIAL_SERVICE_LINKEDIN = 4;

  exports.OAUTH_CREDENTIAL_SERVICE_WSJ = 5;

  exports.OAUTH_CREDENTIAL_SERVICE_NIKKEI = 6;

  exports.OAUTH_CREDENTIAL_SERVICE_IDS = [1,2,3,4,5,6];

  exports.EDAM_OAUTH_SCOPE_LEN_MAX = 4096;

  exports.EDAM_OAUTH_SCOPE_LEN_MIN = 0;

  exports.EDAM_OAUTH_VERSION_1 = 1;

  exports.EDAM_OAUTH_VERSION_2 = 2;

  exports.EDAM_OAUTH_VERSIONS = [1,2];

  exports.SupportTicket = Thrift.Struct.define('SupportTicket',  {
    1: { alias: 'applicationVersion', type: Thrift.Type.STRING },
    2: { alias: 'contactEmail', type: Thrift.Type.STRING },
    3: { alias: 'osInfo', type: Thrift.Type.STRING },
    4: { alias: 'deviceInfo', type: Thrift.Type.STRING },
    5: { alias: 'carrierInfo', type: Thrift.Type.STRING },
    6: { alias: 'connectionInfo', type: Thrift.Type.STRING },
    7: { alias: 'logFile', type: Thrift.Type.STRUCT, def: Types.Data },
    8: { alias: 'subject', type: Thrift.Type.STRING },
    9: { alias: 'issueDescription', type: Thrift.Type.STRING }
  });

  exports.AppFeedback = Thrift.Struct.define('AppFeedback',  {
    1: { alias: 'rating', type: Thrift.Type.BYTE },
    2: { alias: 'feedback', type: Thrift.Type.STRUCT, def: exports.SupportTicket },
    3: { alias: 'requestFollowup', type: Thrift.Type.BOOL },
    4: { alias: 'ratingPerformance', type: Thrift.Type.BYTE },
    5: { alias: 'ratingFeatures', type: Thrift.Type.BYTE },
    6: { alias: 'ratingStability', type: Thrift.Type.BYTE },
    7: { alias: 'ratingEaseOfUse', type: Thrift.Type.BYTE }
  });

  exports.MarketingEmailParameters = Thrift.Struct.define('MarketingEmailParameters',  {
    1: { alias: 'marketingEmailType', type: Thrift.Type.I32 }
  });

  exports.CrossPromotionInfo = Thrift.Struct.define('CrossPromotionInfo',  {
    1: { alias: 'usesEvernoteWindows', type: Thrift.Type.BOOL },
    2: { alias: 'usesEvernoteMac', type: Thrift.Type.BOOL },
    3: { alias: 'usesEvernoteIOS', type: Thrift.Type.BOOL },
    4: { alias: 'usesEvernoteAndroid', type: Thrift.Type.BOOL },
    5: { alias: 'usesWebClipper', type: Thrift.Type.BOOL },
    6: { alias: 'usesClearly', type: Thrift.Type.BOOL },
    7: { alias: 'usesFoodIOS', type: Thrift.Type.BOOL },
    8: { alias: 'usesFoodAndroid', type: Thrift.Type.BOOL },
    9: { alias: 'usesPenultimateIOS', type: Thrift.Type.BOOL },
    10: { alias: 'usesSkitchWindows', type: Thrift.Type.BOOL },
    11: { alias: 'usesSkitchMac', type: Thrift.Type.BOOL },
    12: { alias: 'usesSkitchIOS', type: Thrift.Type.BOOL },
    13: { alias: 'usesSkitchAndroid', type: Thrift.Type.BOOL },
    14: { alias: 'usesEvernoteSalesforce', type: Thrift.Type.BOOL }
  });

  exports.FriendReferral = Thrift.Struct.define('FriendReferral',  {
    1: { alias: 'created', type: Thrift.Type.I64 },
    2: { alias: 'email', type: Thrift.Type.STRING },
    3: { alias: 'referredUserId', type: Thrift.Type.I32 },
    4: { alias: 'pointsEarned', type: Thrift.Type.I32 }
  });

  exports.OAuthCredential = Thrift.Struct.define('OAuthCredential',  {
    1: { alias: 'serviceId', type: Thrift.Type.I16 },
    2: { alias: 'oAuthVersion', type: Thrift.Type.I16 },
    3: { alias: 'accessToken', type: Thrift.Type.STRING },
    4: { alias: 'scope', type: Thrift.Type.STRING },
    5: { alias: 'created', type: Thrift.Type.I64 },
    6: { alias: 'updated', type: Thrift.Type.I64 },
    7: { alias: 'expires', type: Thrift.Type.I64 },
    8: { alias: 'refreshAfter', type: Thrift.Type.I64 }
  });

  exports.RelatedContentSourcePreference = Thrift.Struct.define('RelatedContentSourcePreference',  {
    1: { alias: 'sourceId', type: Thrift.Type.STRING },
    2: { alias: 'activated', type: Thrift.Type.BOOL },
    3: { alias: 'sourceName', type: Thrift.Type.STRING },
    4: { alias: 'sourceUrl', type: Thrift.Type.STRING },
    5: { alias: 'faviconUrl', type: Thrift.Type.STRING },
    6: { alias: 'sourceDescription', type: Thrift.Type.STRING },
    7: { alias: 'sourceType', type: Thrift.Type.I32 }
  });

  exports.RelatedContentProfile = Thrift.Struct.define('RelatedContentProfile',  {
    1: { alias: 'id', type: Thrift.Type.STRING },
    2: { alias: 'sourceId', type: Thrift.Type.STRING },
    3: { alias: 'userId', type: Thrift.Type.I32 },
    4: { alias: 'type', type: Thrift.Type.I32 },
    5: { alias: 'fullName', type: Thrift.Type.STRING },
    6: { alias: 'callingName', type: Thrift.Type.STRING },
    7: { alias: 'photoUrl', type: Thrift.Type.STRING },
    8: { alias: 'shortDescription', type: Thrift.Type.STRING },
    9: { alias: 'longDescription', type: Thrift.Type.STRING },
    10: { alias: 'contactUrls', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
    11: { alias: 'organizations', type: Thrift.Type.MAP, def: Thrift.Map.define(Thrift.Type.STRING, Thrift.Type.STRING )  }
  });

  exports.RelatedContentProfilePage = Thrift.Struct.define('RelatedContentProfilePage',  {
    1: { alias: 'relatedContentProfile', type: Thrift.Type.STRUCT, def: exports.RelatedContentProfile },
    2: { alias: 'userProfile', type: Thrift.Type.STRUCT, def: Types.UserProfile }
  });

  exports.PromotionStatus = Thrift.Struct.define('PromotionStatus',  {
    1: { alias: 'promotionId', type: Thrift.Type.STRING },
    2: { alias: 'optedOut', type: Thrift.Type.BOOL },
    3: { alias: 'shownCount', type: Thrift.Type.I32 },
    4: { alias: 'timeLastShown', type: Thrift.Type.I64 }
  });

  exports.RealTimeAuthentication = Thrift.Struct.define('RealTimeAuthentication',  {
    1: { alias: 'authenticationToken', type: Thrift.Type.STRING }
  });

  exports.RealTimePing = Thrift.Struct.define('RealTimePing');

  exports.RealTimeRequest = Thrift.Struct.define('RealTimeRequest',  {
    1: { alias: 'realTimeAuthentication', type: Thrift.Type.STRUCT, def: exports.RealTimeAuthentication },
    2: { alias: 'realTimePing', type: Thrift.Type.STRUCT, def: exports.RealTimePing }
  });

  exports.RealTimeAuthenticationResult = Thrift.Struct.define('RealTimeAuthenticationResult',  {
    1: { alias: 'pingFrequency', type: Thrift.Type.I16 },
    2: { alias: 'userMaxMessageEventId', type: Thrift.Type.I64 }
  });

  exports.MessageNotification = Thrift.Struct.define('MessageNotification',  {
    1: { alias: 'syncChunk', type: Thrift.Type.STRUCT, def: MessageStore.MessageSyncChunk },
    2: { alias: 'previousEventId', type: Thrift.Type.I64 }
  });

  exports.RealTimeNotification = Thrift.Struct.define('RealTimeNotification',  {
    1: { alias: 'authenticationResult', type: Thrift.Type.STRUCT, def: exports.RealTimeAuthenticationResult },
    2: { alias: 'messageNotification', type: Thrift.Type.STRUCT, def: exports.MessageNotification },
    3: { alias: 'realTimePing', type: Thrift.Type.STRUCT, def: exports.RealTimePing }
  });

  exports.MessagingInvitation = Thrift.Struct.define('MessagingInvitation',  {
    1: { alias: 'id', type: Thrift.Type.STRING },
    2: { alias: 'senderUserId', type: Thrift.Type.I32 },
    3: { alias: 'senderFullName', type: Thrift.Type.STRING },
    4: { alias: 'senderPhoto', type: Thrift.Type.BINARY },
    5: { alias: 'invitedIdentityId', type: Thrift.Type.I64 },
    6: { alias: 'invitedContactId', type: Thrift.Type.STRING },
    7: { alias: 'invitedContactType', type: Thrift.Type.I32 },
    8: { alias: 'msgCount', type: Thrift.Type.I32 },
    9: { alias: 'firstMsgSentAt', type: Thrift.Type.I64 },
    10: { alias: 'created', type: Thrift.Type.I64 },
    11: { alias: 'threadId', type: Thrift.Type.I64 }
  });

  exports.TeamStarterPackRequest = Thrift.Struct.define('TeamStarterPackRequest',  {
    1: { alias: 'commerceService', type: Thrift.Type.STRING },
    2: { alias: 'appStoreLocale', type: Thrift.Type.STRING }
  });

  exports.TeamStarterPackResult = Thrift.Struct.define('TeamStarterPackResult',  {
    1: { alias: 'canPurchaseTeamStarterPack', type: Thrift.Type.BOOL },
    2: { alias: 'sku', type: Thrift.Type.STRING },
    3: { alias: 'seats', type: Thrift.Type.I32 },
    4: { alias: 'months', type: Thrift.Type.I32 }
  });

  var Utility = exports.Utility = {};

  Utility.sendMarketingEmail = Thrift.Method.define({
    alias: 'sendMarketingEmail',
    args: Thrift.Struct.define('sendMarketingEmailArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'parameters', type: Thrift.Type.STRUCT, def: exports.MarketingEmailParameters, index: 1 }
    }),
    result: Thrift.Struct.define('sendMarketingEmailResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  Utility.fileSupportTicket = Thrift.Method.define({
    alias: 'fileSupportTicket',
    args: Thrift.Struct.define('fileSupportTicketArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'ticket', type: Thrift.Type.STRUCT, def: exports.SupportTicket, index: 1 }
    }),
    result: Thrift.Struct.define('fileSupportTicketResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  Utility.sendAppFeedback = Thrift.Method.define({
    alias: 'sendAppFeedback',
    args: Thrift.Struct.define('sendAppFeedbackArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'appFeedback', type: Thrift.Type.STRUCT, def: exports.AppFeedback, index: 1 }
    }),
    result: Thrift.Struct.define('sendAppFeedbackResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  Utility.sendAppFeedbackForDevice = Thrift.Method.define({
    alias: 'sendAppFeedbackForDevice',
    args: Thrift.Struct.define('sendAppFeedbackForDeviceArgs', {
      1: { alias: 'deviceIdentifier', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'apiConsumerKey', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'apiConsumerSecret', type: Thrift.Type.STRING, index: 2 },
      4: { alias: 'appFeedback', type: Thrift.Type.STRUCT, def: exports.AppFeedback, index: 3 }
    }),
    result: Thrift.Struct.define('sendAppFeedbackForDeviceResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  Utility.getCrossPromotionInfo = Thrift.Method.define({
    alias: 'getCrossPromotionInfo',
    args: Thrift.Struct.define('getCrossPromotionInfoArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getCrossPromotionInfoResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.CrossPromotionInfo },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  Utility.referFriends = Thrift.Method.define({
    alias: 'referFriends',
    args: Thrift.Struct.define('referFriendsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'referredEmails', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING) , index: 1 }
    }),
    result: Thrift.Struct.define('referFriendsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  Utility.listFriendReferrals = Thrift.Method.define({
    alias: 'listFriendReferrals',
    args: Thrift.Struct.define('listFriendReferralsArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('listFriendReferralsResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.FriendReferral)  },
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException }
    })
  });

  Utility.sendVerificationEmail = Thrift.Method.define({
    alias: 'sendVerificationEmail',
    args: Thrift.Struct.define('sendVerificationEmailArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('sendVerificationEmailResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  Utility.confirmEmailAddress = Thrift.Method.define({
    alias: 'confirmEmailAddress',
    args: Thrift.Struct.define('confirmEmailAddressArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('confirmEmailAddressResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  Utility.getOAuthCredential = Thrift.Method.define({
    alias: 'getOAuthCredential',
    args: Thrift.Struct.define('getOAuthCredentialArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'serviceId', type: Thrift.Type.I16, index: 1 }
    }),
    result: Thrift.Struct.define('getOAuthCredentialResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.OAuthCredential },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.hasOAuthCredential = Thrift.Method.define({
    alias: 'hasOAuthCredential',
    args: Thrift.Struct.define('hasOAuthCredentialArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'serviceId', type: Thrift.Type.I16, index: 1 }
    }),
    result: Thrift.Struct.define('hasOAuthCredentialResult', {
      0: { alias: 'returnValue',type: Thrift.Type.BOOL },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.setOAuthCredential = Thrift.Method.define({
    alias: 'setOAuthCredential',
    args: Thrift.Struct.define('setOAuthCredentialArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'oAuthCredential', type: Thrift.Type.STRUCT, def: exports.OAuthCredential, index: 1 }
    }),
    result: Thrift.Struct.define('setOAuthCredentialResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.OAuthCredential },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  Utility.deleteOAuthCredential = Thrift.Method.define({
    alias: 'deleteOAuthCredential',
    args: Thrift.Struct.define('deleteOAuthCredentialArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'serviceId', type: Thrift.Type.I16, index: 1 }
    }),
    result: Thrift.Struct.define('deleteOAuthCredentialResult', {
      1: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.getUserCardScanningEndDate = Thrift.Method.define({
    alias: 'getUserCardScanningEndDate',
    args: Thrift.Struct.define('getUserCardScanningEndDateArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getUserCardScanningEndDateResult', {
      0: { alias: 'returnValue',type: Thrift.Type.I64 },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.getPromotionStatus = Thrift.Method.define({
    alias: 'getPromotionStatus',
    args: Thrift.Struct.define('getPromotionStatusArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'promotionIds', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING) , index: 1 }
    }),
    result: Thrift.Struct.define('getPromotionStatusResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.PromotionStatus)  },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.promotionsShown = Thrift.Method.define({
    alias: 'promotionsShown',
    args: Thrift.Struct.define('promotionsShownArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'promotionIds', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRING) , index: 1 }
    }),
    result: Thrift.Struct.define('promotionsShownResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.PromotionStatus)  },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.promotionOptedOut = Thrift.Method.define({
    alias: 'promotionOptedOut',
    args: Thrift.Struct.define('promotionOptedOutArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'promotionId', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('promotionOptedOutResult', {
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.getRelatedContentSourcePreferences = Thrift.Method.define({
    alias: 'getRelatedContentSourcePreferences',
    args: Thrift.Struct.define('getRelatedContentSourcePreferencesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getRelatedContentSourcePreferencesResult', {
      0: { alias: 'returnValue',type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.RelatedContentSourcePreference)  },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.setRelatedContentSourceActivated = Thrift.Method.define({
    alias: 'setRelatedContentSourceActivated',
    args: Thrift.Struct.define('setRelatedContentSourceActivatedArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'sourceId', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'activated', type: Thrift.Type.BOOL, index: 2 }
    }),
    result: Thrift.Struct.define('setRelatedContentSourceActivatedResult', {
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.clearRelatedContentProfiles = Thrift.Method.define({
    alias: 'clearRelatedContentProfiles',
    args: Thrift.Struct.define('clearRelatedContentProfilesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'sourceId', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('clearRelatedContentProfilesResult', {
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.addRelatedContentProfiles = Thrift.Method.define({
    alias: 'addRelatedContentProfiles',
    args: Thrift.Struct.define('addRelatedContentProfilesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'profiles', type: Thrift.Type.LIST, def: Thrift.List.define(Thrift.Type.STRUCT, exports.RelatedContentProfile) , index: 1 }
    }),
    result: Thrift.Struct.define('addRelatedContentProfilesResult', {
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.updateRelatedContentProfiles = Thrift.Method.define({
    alias: 'updateRelatedContentProfiles',
    args: Thrift.Struct.define('updateRelatedContentProfilesArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'sourceId', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('updateRelatedContentProfilesResult', {
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.getRelatedContentProfilePage = Thrift.Method.define({
    alias: 'getRelatedContentProfilePage',
    args: Thrift.Struct.define('getRelatedContentProfilePageArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'profileId', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('getRelatedContentProfilePageResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.RelatedContentProfilePage },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.importNotesFromEnex = Thrift.Method.define({
    alias: 'importNotesFromEnex',
    args: Thrift.Struct.define('importNotesFromEnexArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'enexUrl', type: Thrift.Type.STRING, index: 1 },
      3: { alias: 'notebookGuid', type: Thrift.Type.STRING, index: 2 },
      4: { alias: 'importNoteTags', type: Thrift.Type.BOOL, index: 3 },
      5: { alias: 'importNoteCreated', type: Thrift.Type.BOOL, index: 4 },
      6: { alias: 'importNoteUpdated', type: Thrift.Type.BOOL, index: 5 }
    }),
    result: Thrift.Struct.define('importNotesFromEnexResult', {
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.setUserProfilePhoto = Thrift.Method.define({
    alias: 'setUserProfilePhoto',
    args: Thrift.Struct.define('setUserProfilePhotoArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'photo', type: Thrift.Type.BINARY, index: 1 }
    }),
    result: Thrift.Struct.define('setUserProfilePhotoResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  Utility.removeUserProfilePhoto = Thrift.Method.define({
    alias: 'removeUserProfilePhoto',
    args: Thrift.Struct.define('removeUserProfilePhotoArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('removeUserProfilePhotoResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  Utility.setUserFullName = Thrift.Method.define({
    alias: 'setUserFullName',
    args: Thrift.Struct.define('setUserFullNameArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'name', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('setUserFullNameResult', {
      1: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException },
      2: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      3: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException }
    })
  });

  Utility.getMessageInvitation = Thrift.Method.define({
    alias: 'getMessageInvitation',
    args: Thrift.Struct.define('getMessageInvitationArgs', {
      1: { alias: 'messageInvitationId', type: Thrift.Type.STRING, index: 0 }
    }),
    result: Thrift.Struct.define('getMessageInvitationResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.MessagingInvitation },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.claimMessageInvitation = Thrift.Method.define({
    alias: 'claimMessageInvitation',
    args: Thrift.Struct.define('claimMessageInvitationArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'messageInvitationId', type: Thrift.Type.STRING, index: 1 }
    }),
    result: Thrift.Struct.define('claimMessageInvitationResult', {
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'notFoundException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMNotFoundException },
      3: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  Utility.canPurchaseTeamStarterPack = Thrift.Method.define({
    alias: 'canPurchaseTeamStarterPack',
    args: Thrift.Struct.define('canPurchaseTeamStarterPackArgs', {
      1: { alias: 'authenticationToken', type: Thrift.Type.STRING, index: 0 },
      2: { alias: 'request', type: Thrift.Type.STRUCT, def: exports.TeamStarterPackRequest, index: 1 }
    }),
    result: Thrift.Struct.define('canPurchaseTeamStarterPackResult', {
      0: { alias: 'returnValue',type: Thrift.Type.STRUCT, def: exports.TeamStarterPackResult },
      1: { alias: 'systemException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMSystemException },
      2: { alias: 'userException', type: Thrift.Type.EXCEPTION, def: Errors.EDAMUserException }
    })
  });

  // Define Utility Client

  function UtilityClient(output) {
    this.output = output;
    this.seqid = 0;
  }

  UtilityClient.prototype.sendMarketingEmail = function(authenticationToken, parameters, callback) {
    var mdef = Utility.sendMarketingEmail;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.parameters = parameters;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.fileSupportTicket = function(authenticationToken, ticket, callback) {
    var mdef = Utility.fileSupportTicket;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.ticket = ticket;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.sendAppFeedback = function(authenticationToken, appFeedback, callback) {
    var mdef = Utility.sendAppFeedback;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.appFeedback = appFeedback;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.sendAppFeedbackForDevice = function(deviceIdentifier, apiConsumerKey, apiConsumerSecret, appFeedback, callback) {
    var mdef = Utility.sendAppFeedbackForDevice;
    var args = new mdef.args();
    args.deviceIdentifier = deviceIdentifier;
    args.apiConsumerKey = apiConsumerKey;
    args.apiConsumerSecret = apiConsumerSecret;
    args.appFeedback = appFeedback;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.getCrossPromotionInfo = function(authenticationToken, callback) {
    var mdef = Utility.getCrossPromotionInfo;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.referFriends = function(authenticationToken, referredEmails, callback) {
    var mdef = Utility.referFriends;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.referredEmails = referredEmails;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.listFriendReferrals = function(authenticationToken, callback) {
    var mdef = Utility.listFriendReferrals;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.sendVerificationEmail = function(authenticationToken, callback) {
    var mdef = Utility.sendVerificationEmail;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.confirmEmailAddress = function(authenticationToken, callback) {
    var mdef = Utility.confirmEmailAddress;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.getOAuthCredential = function(authenticationToken, serviceId, callback) {
    var mdef = Utility.getOAuthCredential;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.serviceId = serviceId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.hasOAuthCredential = function(authenticationToken, serviceId, callback) {
    var mdef = Utility.hasOAuthCredential;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.serviceId = serviceId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.setOAuthCredential = function(authenticationToken, oAuthCredential, callback) {
    var mdef = Utility.setOAuthCredential;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.oAuthCredential = oAuthCredential;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.deleteOAuthCredential = function(authenticationToken, serviceId, callback) {
    var mdef = Utility.deleteOAuthCredential;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.serviceId = serviceId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.getUserCardScanningEndDate = function(authenticationToken, callback) {
    var mdef = Utility.getUserCardScanningEndDate;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.getPromotionStatus = function(authenticationToken, promotionIds, callback) {
    var mdef = Utility.getPromotionStatus;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.promotionIds = promotionIds;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.promotionsShown = function(authenticationToken, promotionIds, callback) {
    var mdef = Utility.promotionsShown;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.promotionIds = promotionIds;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.promotionOptedOut = function(authenticationToken, promotionId, callback) {
    var mdef = Utility.promotionOptedOut;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.promotionId = promotionId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.getRelatedContentSourcePreferences = function(authenticationToken, callback) {
    var mdef = Utility.getRelatedContentSourcePreferences;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.setRelatedContentSourceActivated = function(authenticationToken, sourceId, activated, callback) {
    var mdef = Utility.setRelatedContentSourceActivated;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.sourceId = sourceId;
    args.activated = activated;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.clearRelatedContentProfiles = function(authenticationToken, sourceId, callback) {
    var mdef = Utility.clearRelatedContentProfiles;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.sourceId = sourceId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.addRelatedContentProfiles = function(authenticationToken, profiles, callback) {
    var mdef = Utility.addRelatedContentProfiles;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.profiles = profiles;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.updateRelatedContentProfiles = function(authenticationToken, sourceId, callback) {
    var mdef = Utility.updateRelatedContentProfiles;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.sourceId = sourceId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.getRelatedContentProfilePage = function(authenticationToken, profileId, callback) {
    var mdef = Utility.getRelatedContentProfilePage;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.profileId = profileId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.importNotesFromEnex = function(authenticationToken, enexUrl, notebookGuid, importNoteTags, importNoteCreated, importNoteUpdated, callback) {
    var mdef = Utility.importNotesFromEnex;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.enexUrl = enexUrl;
    args.notebookGuid = notebookGuid;
    args.importNoteTags = importNoteTags;
    args.importNoteCreated = importNoteCreated;
    args.importNoteUpdated = importNoteUpdated;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.setUserProfilePhoto = function(authenticationToken, photo, callback) {
    var mdef = Utility.setUserProfilePhoto;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.photo = photo;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.removeUserProfilePhoto = function(authenticationToken, callback) {
    var mdef = Utility.removeUserProfilePhoto;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.setUserFullName = function(authenticationToken, name, callback) {
    var mdef = Utility.setUserFullName;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.name = name;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.getMessageInvitation = function(messageInvitationId, callback) {
    var mdef = Utility.getMessageInvitation;
    var args = new mdef.args();
    args.messageInvitationId = messageInvitationId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.claimMessageInvitation = function(authenticationToken, messageInvitationId, callback) {
    var mdef = Utility.claimMessageInvitation;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.messageInvitationId = messageInvitationId;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  UtilityClient.prototype.canPurchaseTeamStarterPack = function(authenticationToken, request, callback) {
    var mdef = Utility.canPurchaseTeamStarterPack;
    var args = new mdef.args();
    args.authenticationToken = authenticationToken;
    args.request = request;
    mdef.sendRequest(this.output, this.seqid++, args, callback);
  };

  exports.Utility.Client = UtilityClient;

  // Define Utility Server

  function UtilityServer(service, stransport, Protocol) {
    var methodName;
      this.service = service;
      this.stransport = stransport;
      this.processor = new Thrift.Processor();
      for (methodName in Utility) {
        if (service[methodName]) {
          this.processor.addMethod(Utility[methodName], service[methodName].bind(service));
        }
      }
      this.stransport.process = function (input, output, noop) {
      var inprot = new Protocol(input);
      var outprot = new Protocol(output);
      this.processor.process(inprot, outprot, noop);
    }.bind(this);
  }

  UtilityServer.prototype.start = function () {
    this.stransport.listen();
  };
  UtilityServer.prototype.stop = function () {
    this.stransport.close();
  };

  exports.Utility.Server = UtilityServer;

  return exports;

});
/**
 * Implementation of WebSocket-based realtime notification API
 *
 * @author bkepner
 */
define(
    'RealTimeMessageService',[ 'jquery', 'exponential-counter', 'thrift', 'TBinaryProtocol', 'local-storage',
        'ArrayBufferSerializerTransport', 'interwindow-message-queue', 'binary-utils', 'Utility' ],
    function($, ExponentialCounter, Thrift, TBinaryProtocol, localStorage,
        ArrayBufferSerializerTransport, interWindowMessageQueue, binaryUtils, Utility) {
      // Aliases for Thrift types that we use
      var RealTimeAuthentication = Utility.RealTimeAuthentication;
      var RealTimeNotification = Utility.RealTimeNotification;
      var RealTimePing = Utility.RealTimePing;
      var RealTimeRequest = Utility.RealTimeRequest;

      // interwindow message queue topics
      var ATTEMPT_CONNECT_TOPIC = "RTMS_AttemptConnect";
      var REAL_TIME_EVENT_TOPIC = "RTMS_MessageEvents";
      var SOCKET_HOLDER_HEARTBEAT_TOPIC = "RTMS_SocketHeartbeat";
      var SOCKET_LOCK_KEY = "RTMS_SocketLock";

      var SOCKET_HOLDER_HEARTBEAT_INTERVAL_MILLIS = 1000;
      var SOCKET_HOLDER_HEARTBEAT_TIMEOUT_MILLIS = 3000;

      var WINDOW_ID = "" + Math.random() + (new Date()).getTime();

      // The time in milliseconds to wait to recieve a pong (or any
      // other message) after sending a ping before we will assume that
      // the websocket is not actually open and will attempt to reconnect.
      var PONG_TIMEOUT_MILLIS = 15 * 1000;

      // The reason code passed to close when a pong timeout occurs
      var PONG_TIMEOUT_CLOSE_REASON = 'pong_timeout';


      // The reason code passed to close when the service closes our
      // connection because another websocket was subsequently opened for
      // the same auth token
      var SESSION_REPLACED_REASON = 'AuthenticationToken.sessionReplaced';

      // Setup a thrift transport/protocol stack for serialization and
      // deserialization of realtime messages
      var transport = new ArrayBufferSerializerTransport();
      var protocol = new TBinaryProtocol(transport, true, true);

      /**
       * Create a new RealTimeMessageService.
       *
       * config should include:
       *
       * @param hostName
       *          the host name that requests should be sent to
       * @param shardId
       *          The shard id of the user
       * @param secure
       *          Whether to use the secure protocol to connect the web socket.
       *          Defaults to true
       * @param realTimeAuthHandler
       *          A callback to be called when a RealTimeAuthenticationResult is
       *          received. The first argument passed to the function will be
       *          the RealTimeAuthenticationResult struct
       * @param messageNotificationHandler
       *          A callback to be called when a MessageNotification is
       *          received. The first argument passed to the function will be
       *          the MessageNotification struct
       * @param rawNotificationHandler
       *          A callback to be called when any RealtimeNotification is
       *          received. The first argument passed to the function will be an
       *          ArrayBuffer of the notification bytes
       * @param closeHandler
       *          A callback to be called when the underlying socket connection
       *          is closed
       */
      var RealTimeMessageService = function(config) {
        var self = this;
        self._config = config;
        // set the url of the realtime notification endpoint
        var protocol = (config.secure || config.secure === undefined) ? 'wss://'
            : 'ws://';
        // this should end up looking something like
        // wss://ws.www.evernote.com/shard/s1/id
        // but for localhost we will continue to use
        // ws://localhostname:portname/ws/shard/s1/id
        var isLocalhost = config.hostName.indexOf(':') != -1;
        if (isLocalhost) {
          self._url = protocol + config.hostName + '/ws/shard/'
              + config.shardId + '/id';
        } else {
          self._url = protocol + 'ws.' + config.hostName + '/shard/'
              + config.shardId + '/id';
        }

        if (typeof config.realTimeAuthHandler === 'function') {
          self._onRealTimeAuth = config.realTimeAuthHandler;
        }
        if (typeof config.messageNotificationHandler === 'function') {
          self._onMessageNotification = config.messageNotificationHandler;
        }
        if (typeof config.rawNotificationHandler === 'function') {
          self._onNotification = config.rawNotificationHandler;
        }

        // Set up / reset the counter that tracks how long to wait before
        // attempting to reconnect the transport after a recoverable failure
        self._reconnectCounter = new ExponentialCounter(1000, 1000, 100000);

        interWindowMessageQueue.subscribe(REAL_TIME_EVENT_TOPIC, function(
            stringEncodedMessageBytes) {
          // Convert the string to a Uint8Array and get the underlying array buffer
          var bytes = binaryUtils.base64StringToUint8Arr(stringEncodedMessageBytes).buffer;
          self._onMessage({ data : bytes });
        });


        interWindowMessageQueue.subscribe(SOCKET_HOLDER_HEARTBEAT_TOPIC, function() {
          // Whenever we receive a heartbeat message we delay attempting to
          // acquire the lock ourselves since the lock holder is still
          // active

          self._resetAttemptAcquireLockTimer();
        });

        interWindowMessageQueue.subscribe(ATTEMPT_CONNECT_TOPIC, function() {
          // if we currently hold the socket, force an immediate connect attempt
          // we check explicitly here to see if we hold the socket lock to
          // prevent reentry and an infinite publishing loop on the
          // ATTEMPT_CONNECT_TOPIC
          if (self._holdsSocketLock) {
            self._connect();
          }
        });

        if (!interWindowMessageQueue.peek(SOCKET_HOLDER_HEARTBEAT_TOPIC)) {
          // No one else has claimed the socket lock yet, so initiate an attempt immediately
          self._attemptToAcquireLock();
        } else {
          // setup the attempt acquire lock timer
          self._resetAttemptAcquireLockTimer();
        }

        // close the RTMS if the user navigates away from this window
        $(window).on( "unload", function() {
          self.close();
        });


        // setup sleep recovery check
        setInterval(function() {
          if (self.isConnected()
              && !self._isWaitingForPong()
              && self._pingFrequencyMillis != null
              && self._lastMessageReceivedTimestamp != null
              && ((new Date()).getTime() - self._lastMessageReceivedTimestamp) > self._pingFrequencyMillis
                  + PONG_TIMEOUT_MILLIS) {
            // If the computer goes to sleep, most browsers will reset any
            // pending timers to run 'period' milliseconds from when the
            // computer wakes up, which means that any pending pings will be
            // significantly delayed. In many browsers there is a bug where the
            // socket will appear open when the computer wakes up even
            // though it is actually closed. To compensate for this, if it
            // looks like we are connected but haven't received any kind of
            // message within the maximum window for a ping and pong
            // response we will trigger an immediate ping and see if we get
            // a pong back within the pong timeout or not. We should never
            // end up in this circumstance if we are not waking up from
            // sleep or something equivalent because the ping task should
            // have been pinging and receiving pongs significanly more often
            // than this situation would indicate.
            self._sendPing();
          }
        }, 7000);

        // setup and open the transport
        self._connect();
      }

      RealTimeMessageService.prototype = {
        /*
         * Setup and open a connection on a new WebSocket
         */
        _connect : function() {
          var self = this;

          if (!self._holdsSocketLock) {
            // If we don't hold the socket lock, tell the socket holder to
            // attempt to connect if they are note currently connected,
            // but do not attempt to connect ourselves.
            interWindowMessageQueue.publish(ATTEMPT_CONNECT_TOPIC, "");
            return;
          }

          if (self.isConnected()) {
            // Don't attempt to connect if we are already connected or in the
            // process of connecting.
            return;
          }

          self._logMessage("Attempting to connect", true);

          // This construction should always "succeed" (insofar as it won't
          // throw an exception or stop execution) so long as we don't construct
          // it in a fundamentally invalid way (nonsense TCP port, nonsense or
          // invalid URL, etc.).
          self._socket = new WebSocket(self._url);
          // send and receive binary data as ArrayBuffers
          self._socket.binaryType = 'arraybuffer';
          // setup callback for when socket is ready we define this inline so we
          // don't have to keep a reference to the auth token.
          self._socket.onopen = function() {
            self._logMessage("RTMS open", true);
            // Reset the counter that tracks how long to wait before
            // attempting to reconnect
            self._reconnectCounter.reset();

            // authenticate ourselves
            var authRequest = new RealTimeRequest({
              realTimeAuthentication : new RealTimeAuthentication()
            });
            var realtimeAuthBytes = self._serializeThriftStruct(RealTimeRequest, authRequest);
            // send our authentication request
            self._socket.send(realtimeAuthBytes);
          };
          // Setup demultiplexing message handler
          self._socket.onmessage = function(message) {
            // If we receive a message we know that we have the active WebSocket
            // (only one window in a given browser will have it). Since that is
            // the case, we publish the message to any other windows that may be
            // listening but not have an active socket
            var stringEncodedMessageData = binaryUtils
                .uint8ArrToBase64Str(new Uint8Array(message.data));
            interWindowMessageQueue.publish(REAL_TIME_EVENT_TOPIC,
                stringEncodedMessageData);

            self._onMessage(message);
          };
          // set up close handler
          // If anything actually goes wrong with this socket, the handler will
          // be called.
          self._socket.onclose = function(closeEvent) {
            self._logMessage("RTMS closing. ", true, closeEvent);
            self._onClose(closeEvent);

            if (typeof self._config.closeHandler === 'function') {
              try {
                self._config.closeHandler(closeEvent);
              } catch (e) {
                self._logMessage(e, true);
              }
            }
          };
        },


        /**
         * Log a message
         *
         * @message the message to log
         * @logState whether to include the current socket state in the
         *           message
         * @infoObj an optional additional javascript object that will
         *          be logged for inspection
         */
        _logMessage : function(message, logState, infoObj) {
          var self = this;
          var logMessage = (new Date()).toString() + ": " + message;
          if (logState) {
            var readyState = self._socket ? self._socket.readyState : -1;
            logMessage += " ::: readyState=" + readyState;
          }
          if (window.console != null
              && typeof window.console.log === 'function') {
            window.console.log(logMessage);
            if (infoObj) {
              window.console.log(infoObj);
            }
          }
        },

        /*
         * Handle socket closing
         */
        _onClose : function(closeEvent) {
          var self = this;
          self._logMessage("Socket closing", false, closeEvent);
          /*
           * Examine the close reason so we can decide if it's worth trying to
           * restart the connection. See
           * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent for a
           * full description of close codes
           */
          switch (closeEvent.code) {
          case 1001:
          case 1002:
          case 1005:
          case 1006:
          case 1009:
          case 1010:
          case 1011:
          case 4900: // 4900 is our code for pong timeout, which is recoverable
            // attempt to recover, space out retries according to the
            // exponential backoff counter
            var delay = self._reconnectCounter.value;
            self._reconnectCounter.increment();
            setTimeout(function() {
              self._connect();
            }, delay);
            break;
          case 1000:
            /*
             * 1000 is a 'normal' close, but the only reason the remote will
             * ever return this code is if another socket is opened for this
             * auth token. The service limits the number of websockets open to
             * 1-per-auth-token. If we attempt to re-open the connection here,
             * then 2 browser windows with an RTMS-supporting page open will
             * continually close each others' web socket. To avoid thrashing we
             * do not attempt to reconnect here, and assume that the last page
             * that was opened is the one that should get to have the websocket
             * connection.
             *
             * However, we use a special app-specific close code to indicate an
             * app-layer ping timeout. Chrome and Firefox (and maybe others)
             * will pass 1000 as the code to the socket onclose handler
             * regardless of what code we close the socket with, so we check the
             * reason in our onclose handler, and maybe treat 1000 as a
             * recoverable close.
             */
             if (closeEvent.reason == PONG_TIMEOUT_CLOSE_REASON) {
               var delay = self._reconnectCounter.value;
               self._reconnectCounter.increment();
               setTimeout(function() {
                 self._connect();
               }, delay);
               return;
             } else if (closeEvent.reason == SESSION_REPLACED_REASON) {
               // The connection was closed because another tab opened a
                // websocket connection. This happens sometimes in browsers
                // where there is no storage lock (e.g. Chrome); we handle it by
                // 'releasing' the socket lock (which we never actually had),
                // essentially allowing the server to act as a backup
                // synchronization source.
               self._holdsSocketLock = false;
             }
          case 1003:
          case 1007:
          case 1008:
          case 1015:
          default:
            // not recoverable, log failure code / reason and stop
            // Note that for cases other than closing because of a subsequent
            // auth (see above) we will not release the socket lock. This is to
            // prevent other tabs from attempting to start a connection and
            // retry in a situation where we should not continue to attempt to
            // reconnect.
            self.close();
            self._error = closeEvent;
            self._logMessage("Unrecoverable close condition, not retrying");
            // call any attached close handler and stop the keep-alive handler
            clearInterval(self._nextPing);
            if (typeof self._config.closeHandler === 'function') {
              self._config.closeHandler(closeEvent);
            }
          }
        },

        /*
         * Called with the raw ArrayBuffer of any notification received
         */
        _onNotification : function(notificationBytes) {
        },

        /*
         * Placeholder for the realtime auth message handler
         */
        _onRealTimeAuth : function(authResult) {
          var self = this;
          self._logMessage("RealtimeAuthResult", true, authResult);
        },

        /*
         * Placeholder for the messaging notification message handler
         */
        _onMessageNotification : function(messageNotification) {
        },

        /*
         * The WebSocket where we'll receive our realtime notifications
         */
        _socket : null,

        /*
         * Called whenever we recieve a websocket message. Attempt to figure out
         * what type of object we've received and call the appropriate
         * registered handler.
         */
        _onMessage : function(message) {
          var self = this
          var notification, data = message.data;

          // try to deserialize data into a RealTimeAuthenticationResult
          try {
            notification = self._deserializeThriftStruct(RealTimeNotification, data);
          } catch (e) {
            // doesn't seem to be a RealTimeNotification
            console
                .log("Unable to deserialize received bytes as a RealTimeNotification");
            throw e;
          }

          // update the last time we received a message on the socket
          self._lastMessageReceivedTimestamp = (new Date()).getTime();

          // invoke all handlers in their own try/catch so they don't
          // interfere with each other or the RTMS if they fail
          // Handle the different kinds of messages we can recieve
          if (notification.realTimePing) {
            // this is a ping response, reschedule the pong expected timer and
            // don't notify the app
            self._pongReceived();
            return;
          } else if (notification.authenticationResult) {
            try {
              self._pingFrequencyMillis = notification.authenticationResult.pingFrequency * 1000;
              self._onRealTimeAuth(notification.authenticationResult);
            } catch (e) {
              self._logMessage("Error in _onRealTimeAuth.", true, e);
            }
          } else if (notification.messageNotification) {
            try {
              self._onMessageNotification(notification.messageNotification);
            } catch (e) {
              self._logMessage("Error in _onMessageNotification.", true, e);
            }
          } else {
            // Unknown message type. Log and ignore.
            self
                ._logMessage(
                    "Unknown message type, unable to deserialize. You may need to"
                        + " update RealTimeMessageService to support new message types.",
                    true);

          }

          // fire the raw notification handler
          try {
            self._onNotification(data);
          } catch (e) {
            self._logMessage("Error in _onNotification: " + e, true);
          }

          // we received a message, reset the keep-alive timers
          self._schedulePing();
          self._pongReceived();
        },

        /**
         * Schedule a repeating task to keep-alive the connection by sending
         * RealTimePings. If such a task is currently scheduled, it will be
         * cancelled and a new task will be scheduled to execute after
         * this._pingFrequencyMillis.
         */
        _schedulePing : function() {
          var self = this;
          if (!self._pingFrequencyMillis || !self._holdsSocketLock) {
            // either we haven't received an auth result yet or we are not the
            // holder of the socket, so no need to set up the
            // ping task
            return;
          }

          // Clear any currently-scheduled pinger
          if (self._nextPing) {
            clearInterval(self._nextPing);
          }

          // reschedule the pinger
          self._nextPing = setInterval(function() { self._sendPing() }, self._pingFrequencyMillis);
        },

        /*
         * Send a RealTimePing to keep connection alive If
         * the underlying websocket is closed, it will attempt to restart the
         * connection.
         */
        _sendPing : function() {
          var self = this;
          // if connection is open, send ping
          if (!self.isConnected()) {
            return;
          }

          var request = new RealTimeRequest({
            realTimePing : new RealTimePing()
          });
          var reqBytes = self._serializeThriftStruct(RealTimeRequest, request);
          self._socket.send(reqBytes);

          self._logMessage('ping');

          // schedule a timeout checker to close the socket
          // explicitly if we don't get a response within the
          // timeout window
          self._scheduleNextPongExpected();
        },

        _scheduleNextPongExpected : function() {
          var self = this;

          // Make sure we only ever have 1 nextPongExpected timer
          // going at a time
          if (self._nextPongExpected) {
            return;
          }

          self._nextPongExpected = setTimeout(function() {
            if (self.isConnected()) {
              // use a special app-specific close code to indicate an
              // app-layer ping timeout. Note that Chrome and Firefox
              // (and maybe others) will pass 1000 as the code to the
              // socket onclose handler regardless of what code we close
              // the socket with, so we check the reason in our onclose
              // handler. IF YOU CHANGE THE REASON, YOU MUST ALSO UPDATE
              // THE ONCLOSE HANDLER
              self.close(4900, PONG_TIMEOUT_CLOSE_REASON);
            }
          }, PONG_TIMEOUT_MILLIS);
        },

        _pongReceived : function() {
          var self = this;
          if (self._nextPongExpected) {
            clearTimeout(self._nextPongExpected);
            self._nextPongExpected = null;
          }
        },

        /*
         * Return whether we are currently expecting a pending pong response
         * from the server
         */
        _isWaitingForPong : function() {
          return !!self._nextPongExpected;
        },

        /*
         * Read serialized struct data in an ArrayBuffer into a thrift js object
         */
        _deserializeThriftStruct : function(type, data) {
          transport.write(data);
          var struct = Thrift.Struct.read(type, protocol);
          transport.reset();
          return struct;
        },

        /*
         * Write a js thrift object to an ArrayBuffer
         */
        _serializeThriftStruct : function(type, struct) {
          Thrift.Struct.write(type, protocol, struct);
          var bytes = transport.getBytes();
          transport.reset();
          return bytes;
        },

        /**
         * Cancel any existing timer and schedule a new timer to attempt to
         * acquire the socket lock in SOCKET_HOLDER_HEARTBEAT_TIMEOUT_MILLIS
         * milliseconds.
         */
        _resetAttemptAcquireLockTimer : function() {
          var self = this;

          if (self._nextAttemptAcquireLock) {
            // cancel any pending lock acquisition attempt
            clearTimeout(self._nextAttemptAcquireLock);
          }

          // schedule a new lock acquisition attempt
          self._nextAttemptAcquireLock = setTimeout(function() { self._attemptToAcquireLock() },
               SOCKET_HOLDER_HEARTBEAT_TIMEOUT_MILLIS);
        },

        /*
         * Attempt to acquire the socket lock and (if successful) open a
         * websocket in this window.
         *
         * The process of attempting to acquire the lock is:
         *
         * 1. Check the current value of the lock in local storage. If the timestamp
         *    is less than SOCKET_HOLDER_HEARTBEAT_TIMEOUT_MILLIS ago, bail out.
         * 2. Set this window's unique ID and the current timestamp
         *    as the value of the lock key in local storage
         * 3. Wait for the execution context refresh to flush any other windows'
         *    updates to the lock value
         * 4. Check the lock value again, if it is our value, we have the lock,
         *    otherwise another window has the lock.
         */
        _attemptToAcquireLock : function() {
          var self = this;
          self._logMessage('Attempting to acquire socket lock', true);
          var rawValue = localStorage.getItem(SOCKET_LOCK_KEY);
          var currentValue = rawValue ? JSON.parse(rawValue) : null;
          var now = (new Date).getTime();
          if (!currentValue
              || (now - currentValue.time > SOCKET_HOLDER_HEARTBEAT_TIMEOUT_MILLIS)) {
            // Set our own value and check back on it later. In some browsers
            // (Safari, Firefox), we have acquired the global storage lock, and
            // so could check immediately. In other cases (Chrome?, IE11?) there is
            // no storage lock. For simplicity, in both cases we add a random
            // delay to the wait before checking to see if our value is present
            // to make it less likely that two windows both attempt to claim the
            // socket lock. Credit for this idea goes to
            // http://blog.fastmail.com/2012/11/26/inter-tab-communication-using-local-storage/
            var delay = 10 + Math.floor(Math.random() * 250);
            localStorage.setItem(SOCKET_LOCK_KEY, JSON.stringify({ id : WINDOW_ID, time : now}));
            setTimeout(function() {
              // check to see if the lock key is the value we wrote before
              // sleeping. If it is, then we will claim the lock
              var value = JSON.parse(localStorage.getItem(SOCKET_LOCK_KEY));
              if (value.id == WINDOW_ID) {
                // we have the lock
                self._lockAcquired();
              } else {
                // schedule the next lock acquisition attempt
                // note that we will only ever see this log message in browsers that don't
                // have a storage lock
                self._logMessage('Failed to acquire socket lock');
                self._resetAttemptAcquireLockTimer();
              }
            }, delay);
          }
          // someone else already claimed the lock
          // schedule the next lock acquisition attempt
          self._resetAttemptAcquireLockTimer();
        },

        _lockAcquired : function() {
          var self = this;
          self._logMessage('Acquired socket lock');
          self._holdsSocketLock = true;

          // immediately send a heartbeat
          interWindowMessageQueue.publish(SOCKET_HOLDER_HEARTBEAT_TOPIC,
              WINDOW_ID);

          // start sending regular heartbeats
          self._nextSocketHolderHeartbeat = setInterval(function() {
            if (self._holdsSocketLock) {
              interWindowMessageQueue.publish(SOCKET_HOLDER_HEARTBEAT_TOPIC,
                  WINDOW_ID);
            } else {
              clearInterval(self._nextSocketHolderHeartbeat);
            }
          }, SOCKET_HOLDER_HEARTBEAT_INTERVAL_MILLIS);

          // we have the lock, so cancel any attempt to acquire it
          clearTimeout(self._nextAttemptAcquireLock);
          self._nextAttemptAcquireLock = null;

          // open the websocket
          self._connect();
        },

        close : function() {
          var self = this;

          if (self.isConnected()) {
            self._socket.close(1000);
          }

          if (self._holdsSocketLock) {
            localStorage.removeItem(SOCKET_LOCK_KEY);
          }

          self._holdsSocketLock = false;
          self._socket = null;
          self._pingFrequencyMillis = null;
        },

        /**
         * Make sure that the underlying transport is connected. Trigger an
         * immediate connect attempt if we are not connected.
         */
        ensureConnected : function() {
          var self = this;
          self._connect();
        },

        /**
         * Close the transport for this service if it is open
         * @param closeCode The close code to close the socket with (default 1000)
         * @param reason The reason to close the socket with (default client_requested)
         */
        close : function(closeCode, reason) {
          var self = this;
          if (self.isConnected()) {
            // close socket
            closeCode = closeCode || 1000;
            reason = reason || "client_requested";
            self._socket.close(closeCode, reason);
          }
          self._socket = null;
          self._pingFrequencyMillis = null;

          // clear any pong checker
          if (self._nextPongExpected) {
            clearTimeout(self._nextPongExpected);
            self._nextPongExpected = null;
          }
        },

        /**
         * Return whether the transport layer is currently connected
         */
        isConnected : function() {
          var self = this;
          return !!self._socket
              && (self._socket.readyState == WebSocket.OPEN || self._socket.readyState == WebSocket.CONNECTING);
        },

        /*
         * Check if realtime notifications are supported on this browser. This
         * currently is simply a check to see if WebSockets and ArrayBuffer are
         * supported in this browser.
         *
         * We currently do not support MozWebSocket, which is a pre-Firefox-7
         * implementation of WebSockets and is not entirely compatible with the
         * current API.
         */
        isSupported : function() {
          return window.WebSocket !== undefined
          && window.ArrayBuffer !== undefined
          && localStorage.isAvailable();
        }
      };

      return RealTimeMessageService;
    });

