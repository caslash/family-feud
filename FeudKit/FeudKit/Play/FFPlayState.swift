//
//  FFPlayState.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class FFPlayState: State<FFPlayStateType> {
    internal override init(type: FFPlayStateType) {
        super.init(type: type)
    }
    
    public override func updateState(timeElapsed: Float) {
        // Not needed for this machine
    }
}
