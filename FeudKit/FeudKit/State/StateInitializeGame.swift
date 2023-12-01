//
//  StateInitializeGame.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class StateInitializeGame: FFState {
    internal init() { super.init(type: FFStateType.INITIALIZE_GAME) }
    
    public override func initState(data: Any) { }
    
    public override func cleanupState() { }
}
