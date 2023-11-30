//
//  FFPlayStateType.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public enum FFPlayStateType: String, CustomStringConvertible {
    public var description: String {
        return self.rawValue
    }
    
    case SELECT_QUESTION = "select question",
         FACE_OFF = "face off",
         FAMILY_PLAY = "family play",
         FAMILY_STEAL = "family steal",
         ALLOCATE_POINTS = "allocate points",
         REVEAL_ANSWERS = "reveal answers"
}
